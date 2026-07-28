import { DASHBOARD_VERSION } from "../version.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { dashboardReleasePageUrl, getDashboardInstallationStatus, installDashboard, type DashboardInstallationStatus, type InstallDashboardOptions } from "./dashboard-installer.js";
import { getDashboardAcquisitionPolicy, type DashboardAcquisitionPolicy } from "./dashboard-policy.js";

export interface DashboardEnsureOptions extends InstallDashboardOptions {
  /** 仅用于已由平台或对话取得的当次授权，不会修改本机长期策略。 */
  approveOnce?: boolean;
}

export interface DashboardAcquisitionHint {
  version: string;
  platform: string;
  arch: string;
  browserUrl: string;
}

export interface DashboardEnsureResult {
  status: "ready" | "confirmation-required" | "manual-required";
  action: "none" | "install" | "update" | "repair" | "import-local";
  policy: DashboardAcquisitionPolicy;
  installation: DashboardInstallationStatus;
  acquisition?: DashboardAcquisitionHint;
  result?: Awaited<ReturnType<typeof installDashboard>>;
}

function requiredAction(installation: DashboardInstallationStatus, update: boolean): DashboardEnsureResult["action"] {
  if (installation.status === "not-installed") return "install";
  if (installation.status === "installed") return update ? "update" : "none";
  return "repair";
}

function acquisitionHint(options: DashboardEnsureOptions): DashboardAcquisitionHint {
  return {
    version: DASHBOARD_VERSION,
    platform: options.platform ?? process.platform,
    arch: options.arch ?? process.arch,
    browserUrl: dashboardReleasePageUrl(),
  };
}

/**
 * 平台无关的“确保可用”入口：策略允许时确定性执行，策略未授权时只返回一次可展示的意图。
 * 它不会因普通 open 检查下载更新；update 必须是用户或调用方明确提出的意图。
 */
export async function ensureDashboard(
  options: DashboardEnsureOptions = {},
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<DashboardEnsureResult> {
  const [policyState, installation] = await Promise.all([
    getDashboardAcquisitionPolicy(paths),
    getDashboardInstallationStatus(paths),
  ]);
  const action = requiredAction(installation, options.update === true);
  if (action === "none") return { status: "ready", action, policy: policyState.policy, installation };
  const acquisition = acquisitionHint(options);
  if (policyState.policy === "manual" && !options.archivePath) {
    return { status: "manual-required", action: "import-local", policy: policyState.policy, installation, acquisition };
  }
  if (policyState.policy === "ask" && !options.approveOnce && !options.archivePath) {
    return { status: "confirmation-required", action, policy: policyState.policy, installation, acquisition };
  }
  // 用户显式以 --archive 导入，或策略/当次授权允许后，才进入实际网络或文件写入阶段。
  const result = await installDashboard({
    ...options,
    update: action !== "install",
    // 已按策略授权的 repair 应恢复受校验的发布物；不再把损坏安装的二次 --force 确认转嫁给用户。
    force: options.force || action === "repair",
  }, paths);
  return {
    status: "ready",
    action: result.action === "unchanged" ? "none" : action,
    policy: policyState.policy,
    installation: await getDashboardInstallationStatus(paths),
    acquisition,
    result,
  };
}
