import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExitCode } from "../errors.js";
import { createAgentForumPaths } from "../storage/paths.js";
import { DASHBOARD_VERSION, VERSION } from "../version.js";
import { attachDashboardClient, dashboardStatus, detachDashboardClient, getDashboardSnapshot, setDashboardForumPolling, setDashboardRoomPinned } from "../services/dashboard.js";
import { getDashboardInstallationStatus, getDashboardLaunchStatus, uninstallDashboard } from "../services/dashboard-installer.js";
import { ensureDashboard } from "../services/dashboard-ensure.js";
import { ServiceError } from "../services/errors.js";
import { getDashboardAcquisitionPolicy, setDashboardAcquisitionPolicy, type DashboardAcquisitionPolicy } from "../services/dashboard-policy.js";
import { attachExistingDashboardDesktop, closeExistingDashboardDesktop, detachExistingDashboardDesktop } from "../services/dashboard-desktop.js";
import { resolveContext } from "../services/context.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

/** npm package version does not participate: Desktop assets only report their own available update. */
export function dashboardUpdateAvailable(installedVersion: string | undefined, dashboardVersion = DASHBOARD_VERSION): boolean {
  return dashboardVersion !== "0.0.0-dev" && installedVersion !== dashboardVersion;
}

export async function executeDashboardCommand(args: readonly string[], options: { onProgress?: (text: string) => void } = {}): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") return { exitCode: ExitCode.Success, command: "dashboard.help", data: { usage: "agent-forum dashboard <ensure|policy|install|update|install-local|uninstall|open|attach|heartbeat|detach|status|lease-status|snapshot|polling|pin>" }, human: "Dashboard\n\nUsage:\n  agent-forum dashboard ensure [--update] [--approve-once] [--force]\n  agent-forum dashboard policy [--mode <managed|ask|manual>]\n  agent-forum dashboard install [--manifest-url <url>] [--yes]\n  agent-forum dashboard update [--manifest-url <url>] [--yes] [--force]\n  agent-forum dashboard install-local --archive <file> --manifest <file> [--yes] [--force]\n  agent-forum dashboard uninstall [--force]\n  agent-forum dashboard open --client-id <id> --client-type <pi|opencode|codex|claude-code> [--cwd <path>] [--forum <alias> --room <room>] [--identity <member-id>]\n  agent-forum dashboard attach --client-id <id> --client-type <pi|opencode|codex|claude-code> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard heartbeat --client-id <id> --client-type <type> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard detach --client-id <id>\n  agent-forum dashboard status|snapshot\n  agent-forum dashboard polling --forum-id <forum-id> --enabled <true|false>\n  agent-forum dashboard pin --room-id <room-id> --enabled <true|false>\n" };
  try {
    if (subcommand === "lease-status") {
      if (args.length !== 1) return invalidArgument("dashboard lease-status accepts no options");
      const result = await dashboardStatus();
      return { exitCode: ExitCode.Success, command: "dashboard.lease-status", data: result, human: `${result.clients.length} active Dashboard client(s).\n` };
    }
    if (subcommand === "status") {
      if (args.length !== 1) return invalidArgument("dashboard status accepts no options");
      const [result, installation, policy] = await Promise.all([dashboardStatus(), getDashboardInstallationStatus(), getDashboardAcquisitionPolicy()]);
      return { exitCode: ExitCode.Success, command: "dashboard.status", data: { ...result, installation, policy }, human: `Desktop: ${installation.status}; acquisition policy: ${policy.policy}; ${result.clients.length} active Dashboard client(s).\n` };
    }
    if (subcommand === "policy") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--mode"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.values.size === 0) {
        const result = await getDashboardAcquisitionPolicy();
        return { exitCode: ExitCode.Success, command: "dashboard.policy", data: result, human: `Dashboard acquisition policy: ${result.policy}.\n` };
      }
      const mode = parsed.values.get("--mode");
      if (mode !== "managed" && mode !== "ask" && mode !== "manual") return invalidArgument("--mode must be managed, ask, or manual");
      const result = await setDashboardAcquisitionPolicy(mode as DashboardAcquisitionPolicy);
      return { exitCode: ExitCode.Success, command: "dashboard.policy", data: result, human: `Dashboard acquisition policy set to ${result.policy}.\n` };
    }
    if (subcommand === "ensure" || subcommand === "install" || subcommand === "update" || subcommand === "install-local") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--manifest-url", "--manifest", "--archive"], flags: ["--yes", "--force", "--update", "--approve-once"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const manifestUrl = parsed.values.get("--manifest-url");
      const manifestPath = parsed.values.get("--manifest");
      const archivePath = parsed.values.get("--archive");
      const localImport = subcommand === "install-local";
      if (localImport && (!manifestPath || !archivePath)) return invalidArgument("dashboard install-local requires --archive and --manifest");
      if (localImport && manifestUrl) return invalidArgument("dashboard install-local does not accept --manifest-url");
      if (archivePath && !manifestPath && !manifestUrl) return invalidArgument("--archive requires --manifest for offline verification or --manifest-url");
      const update = subcommand === "update" || parsed.flags.has("--update");
      if (subcommand === "update" || (localImport && update)) await closeExistingDashboardDesktop().catch(() => false);
      let lastPercent = -1;
      options.onProgress?.("Checking Dashboard installation…\n");
      const result = await ensureDashboard({
        ...(manifestUrl ? { manifestUrl } : {}),
        ...(manifestPath ? { manifestPath } : {}),
        ...(archivePath ? { archivePath } : {}),
        update,
        force: parsed.flags.has("--force"),
        // install/update --yes 是兼容入口；ensure 的 --approve-once 是跨 Agent 的原子当次授权。
        approveOnce: parsed.flags.has("--approve-once") || parsed.flags.has("--yes") || localImport,
        ...(options.onProgress ? {
          onStatus: (text: string) => options.onProgress!(`${text}\n`),
          onProgress: (received: number, total: number, attempt: number) => {
            const percent = Math.floor(received * 100 / total);
            if (percent !== lastPercent) { lastPercent = percent; options.onProgress!(`Downloading Dashboard: ${percent}% (attempt ${attempt}/3)\r`); }
          },
        } : {}),
      });
      if (result.status === "ready") options.onProgress?.("\n");
      const command = subcommand === "ensure" ? "dashboard.ensure" : `dashboard.${subcommand}`;
      const human = result.status === "ready"
        ? `Dashboard ${result.result?.action ?? "ready"}.\n`
        : result.status === "manual-required"
          ? `Dashboard requires a local archive. Download it from ${result.acquisition?.browserUrl} and run dashboard install-local --archive <file> --manifest <file> --yes.\n`
          : `Dashboard ${result.action} requires one-time approval. Run dashboard ensure --approve-once, or set dashboard policy --mode managed.\n`;
      return { exitCode: ExitCode.Success, command, data: result, human };
    }
    if (subcommand === "uninstall") {
      const parsed = parseCommandOptions(args.slice(1), { values: [], flags: ["--force"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      await closeExistingDashboardDesktop().catch(() => false);
      const result = await uninstallDashboard({ force: parsed.flags.has("--force") });
      return { exitCode: ExitCode.Success, command: "dashboard.uninstall", data: result, human: `Dashboard ${result.action}.\n` };
    }
    if (subcommand === "snapshot") {
      if (args.length !== 1) return invalidArgument("dashboard snapshot accepts no options");
      const result = await getDashboardSnapshot();
      return { exitCode: ExitCode.Success, command: "dashboard.snapshot", data: result, human: `${result.teams.length} active Team(s).\n` };
    }
    if (subcommand === "detach") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--client-id"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id"); if (typeof clientId !== "string") return invalidArgument(clientId.error);
      const result = await detachDashboardClient(clientId);
      await detachExistingDashboardDesktop(clientId).catch(() => false);
      return { exitCode: ExitCode.Success, command: "dashboard.detach", data: result, human: `${result.detached ? "Detached" : "Not attached"}: ${clientId}\n` };
    }
    if (subcommand === "polling") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--forum-id", "--enabled"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumId = requireOption(parsed, "--forum-id"); const enabled = requireOption(parsed, "--enabled");
      if (typeof forumId !== "string") return invalidArgument(forumId.error);
      if (typeof enabled !== "string") return invalidArgument(enabled.error);
      if (enabled !== "true" && enabled !== "false") return invalidArgument("--enabled must be true or false");
      const result = await setDashboardForumPolling(forumId, enabled === "true");
      return { exitCode: ExitCode.Success, command: "dashboard.polling", data: result, human: `Polling ${result.enabled ? "enabled" : "disabled"}: ${forumId}\n` };
    }
    if (subcommand === "open") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--client-id", "--client-type", "--forum", "--room", "--identity", "--cwd"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id"); const clientType = requireOption(parsed, "--client-type");
      if (typeof clientId !== "string" || typeof clientType !== "string") return invalidArgument("dashboard open requires --client-id and --client-type");
      const explicitForum = parsed.values.get("--forum"); const explicitRoom = parsed.values.get("--room"); const cwd = parsed.values.get("--cwd");
      if (Boolean(explicitForum) !== Boolean(explicitRoom)) return invalidArgument("--forum and --room must be provided together");
      const context = explicitForum && explicitRoom ? await resolveContext({ forumAlias: explicitForum, room: explicitRoom, ...(cwd ? { cwd } : {}) }) : await resolveContext({ ...(cwd ? { cwd } : {}) });
      const forum = context.forumAlias; const room = context.roomId;
      if (!forum || context.targetStatus !== "active") return invalidArgument("Dashboard requires an active bound Forum Room");
      const identity = parsed.values.get("--identity");
      const contextData = { forumAlias: forum, roomId: room, roomSlug: context.roomSlug };
      // 已运行实例是最短本机快路径：不读取安装 payload，也不访问 GitHub。
      if (await attachExistingDashboardDesktop({ clientId, clientType, forumAlias: forum, roomId: room, ...(identity ? { identityId: identity } : {}) })) return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, reused: true, ...contextData }, human: "Dashboard already running; client attached.\n" };
      const installed = await getDashboardLaunchStatus();
      // 普通 open 只检查启动所需文件；完整 payload hash 留给 status/ensure/update/repair。
      const updateAvailable = installed.status === "installed" && dashboardUpdateAvailable(installed.installation?.version);
      const updateHint = updateAvailable ? ` Dashboard ${DASHBOARD_VERSION} is available; run agent-forum dashboard ensure --update to follow your acquisition policy.` : "";
      const moduleDirectory = dirname(fileURLToPath(import.meta.url));
      const entrypoint = [resolve(moduleDirectory, "..", "..", "dashboard", "main.ts"), resolve(moduleDirectory, "..", "..", "..", "dashboard", "main.ts")].find(existsSync);
      const deno = process.platform === "win32" ? resolve(homedir(), ".deno", "bin", "deno.exe") : "deno";
      const developmentFallback = installed.status === "not-installed" && (VERSION === "0.0.0-dev" || process.env.AGENT_FORUM_DASHBOARD_DEV === "1") && entrypoint && (process.platform !== "win32" || existsSync(deno));
      if (installed.status !== "installed" && !developmentFallback) throw new ServiceError("DASHBOARD_UNAVAILABLE", installed.status === "not-installed" ? "Dashboard is not installed; run agent-forum dashboard ensure" : "Dashboard installation is damaged; run agent-forum dashboard ensure --update");
      const executable = installed.status === "installed" ? installed.executable! : deno;
      const executableArgs = installed.status === "installed" ? [] : ["desktop", "--icon", resolve(dirname(entrypoint!), process.platform === "win32" ? "icon.ico" : "icon.png"), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net=127.0.0.1", "--allow-ffi", entrypoint!];
      const dashboardCli = installed.status === "installed" ? installed.helper! : process.execPath;
      // CEF 可能在工作目录写入诊断或缓存。固定使用私有 state 目录，绝不让运行时文件污染已校验的安装 payload。
      const dashboardRuntimeDirectory = createAgentForumPaths().dashboardDirectory;
      await mkdir(dashboardRuntimeDirectory, { recursive: true, mode: 0o700 });
      const child = spawn(executable, executableArgs, { cwd: dashboardRuntimeDirectory, detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, AGENT_FORUM_CLI: dashboardCli, AGENT_FORUM_CLI_SCRIPT: installed.status === "installed" ? "" : process.argv[1] ?? "", AGENT_FORUM_DASHBOARD_ICON: installed.status === "installed" ? resolve(dirname(executable), "AppIcon.ico") : resolve(dirname(entrypoint!), "icon.ico"), AGENT_FORUM_DASHBOARD_CLIENT_ID: clientId, AGENT_FORUM_DASHBOARD_CLIENT_TYPE: clientType, AGENT_FORUM_DASHBOARD_FORUM: forum, AGENT_FORUM_DASHBOARD_ROOM: room, ...(typeof identity === "string" ? { AGENT_FORUM_DASHBOARD_IDENTITY: identity } : {}) } });
      child.unref();
      return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, pid: child.pid, updateAvailable, ...contextData }, human: `Dashboard started.${updateHint}\n` };
    }
    if (subcommand === "pin") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--room-id", "--enabled"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const roomId = requireOption(parsed, "--room-id"); const enabled = requireOption(parsed, "--enabled");
      if (typeof roomId !== "string") return invalidArgument(roomId.error);
      if (typeof enabled !== "string") return invalidArgument(enabled.error);
      if (enabled !== "true" && enabled !== "false") return invalidArgument("--enabled must be true or false");
      const result = await setDashboardRoomPinned(roomId, enabled === "true");
      return { exitCode: ExitCode.Success, command: "dashboard.pin", data: result, human: `Pin ${result.pinned ? "enabled" : "disabled"}: ${roomId}\n` };
    }
    if (subcommand === "attach" || subcommand === "heartbeat") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--client-id", "--client-type", "--forum", "--room", "--identity", "--lease-ms"], flags: ["--reset-view"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const clientId = requireOption(parsed, "--client-id"); const clientType = requireOption(parsed, "--client-type");
      if (typeof clientId !== "string") return invalidArgument(clientId.error);
      if (typeof clientType !== "string") return invalidArgument(clientType.error);
      const forumAlias = parsed.values.get("--forum"); const roomId = parsed.values.get("--room");
      if (Boolean(forumAlias) !== Boolean(roomId)) return invalidArgument("--forum and --room must be provided together");
      if (!forumAlias || !roomId) return invalidArgument("Dashboard attach currently requires explicit --forum and --room");
      const leaseText = parsed.values.get("--lease-ms"); const leaseMs = leaseText === undefined ? undefined : Number(leaseText);
      if (leaseText !== undefined && !Number.isInteger(leaseMs)) return invalidArgument("--lease-ms must be an integer");
      const identityId = parsed.values.get("--identity");
      const result = await attachDashboardClient({ clientId, clientType: clientType as "pi" | "opencode" | "codex" | "claude-code", forumAlias, roomId, ...(identityId ? { identityId } : {}), ...(leaseMs !== undefined ? { leaseMs } : {}), resetView: parsed.flags.has("--reset-view") });
      return { exitCode: ExitCode.Success, command: `dashboard.${subcommand}`, data: result, human: `Attached Dashboard client ${result.client.clientId}.\n` };
    }
    return invalidArgument(`unknown dashboard subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`dashboard.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
