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
import { getDashboardInstallationStatus, inspectDashboardRelease, installDashboard, uninstallDashboard } from "../services/dashboard-installer.js";
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
  if (!subcommand || subcommand === "help" || subcommand === "--help") return { exitCode: ExitCode.Success, command: "dashboard.help", data: { usage: "agent-forum dashboard <install|update|uninstall|open|attach|heartbeat|detach|status|snapshot|polling|pin>" }, human: "Dashboard\n\nUsage:\n  agent-forum dashboard install [--manifest-url <url>] [--yes]\n  agent-forum dashboard update [--manifest-url <url>] [--yes] [--force]\n  agent-forum dashboard uninstall [--force]\n  agent-forum dashboard open --client-id <id> --client-type <pi|opencode|codex|claude-code> [--cwd <path>] [--forum <alias> --room <room>] [--identity <member-id>]\n  agent-forum dashboard attach --client-id <id> --client-type <pi|opencode|codex|claude-code> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard heartbeat --client-id <id> --client-type <type> [--forum <alias> --room <room>] [--identity <member-id>] [--lease-ms <ms>]\n  agent-forum dashboard detach --client-id <id>\n  agent-forum dashboard status|snapshot\n  agent-forum dashboard polling --forum-id <forum-id> --enabled <true|false>\n  agent-forum dashboard pin --room-id <room-id> --enabled <true|false>\n" };
  try {
    if (subcommand === "status") {
      if (args.length !== 1) return invalidArgument("dashboard status accepts no options");
      const [result, installation] = await Promise.all([dashboardStatus(), getDashboardInstallationStatus()]);
      return { exitCode: ExitCode.Success, command: "dashboard.status", data: { ...result, installation }, human: `Desktop: ${installation.status}; ${result.clients.length} active Dashboard client(s).\n` };
    }
    if (subcommand === "install" || subcommand === "update") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--manifest-url"], flags: ["--yes", "--force"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const manifestUrl = parsed.values.get("--manifest-url");
      if (!parsed.flags.has("--yes")) {
        const release = await inspectDashboardRelease({ ...(manifestUrl ? { manifestUrl } : {}) });
        return { exitCode: ExitCode.Success, command: `dashboard.${subcommand}`, data: { action: "confirmation-required", version: release.version, platform: release.asset.platform, arch: release.asset.arch, size: release.asset.size, source: release.asset.url, sha256: release.asset.sha256 }, human: `Dashboard ${release.version} for ${release.asset.platform}-${release.asset.arch}\nSource: ${release.asset.url}\nSize: ${release.asset.size} bytes\nSHA-256: ${release.asset.sha256}\nRun again with --yes to confirm the download.\n` };
      }
      if (subcommand === "update") await closeExistingDashboardDesktop().catch(() => false);
      let lastPercent = -1;
      const result = await installDashboard({ ...(manifestUrl ? { manifestUrl } : {}), update: subcommand === "update", force: parsed.flags.has("--force"), ...(options.onProgress ? { onProgress: (received: number, total: number, attempt: number) => { const percent = Math.floor(received * 100 / total); if (percent !== lastPercent) { lastPercent = percent; options.onProgress!(`Downloading Dashboard: ${percent}% (attempt ${attempt}/3)\r`); } } } : {}) });
      options.onProgress?.("\n");
      return { exitCode: ExitCode.Success, command: `dashboard.${subcommand}`, data: result, human: `Dashboard ${result.action}: ${result.installation.version}\n` };
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
      const installed = await getDashboardInstallationStatus();
      // Desktop archive 体积较大；显式打开只提示可用更新，绝不下载或替换用户当前版本。
      const updateAvailable = installed.status === "installed" && dashboardUpdateAvailable(installed.installation?.version);
      const updateHint = updateAvailable ? ` Dashboard ${DASHBOARD_VERSION} is available; run agent-forum dashboard update --yes to install it.` : "";
      if (await attachExistingDashboardDesktop({ clientId, clientType, forumAlias: forum, roomId: room, ...(identity ? { identityId: identity } : {}) })) return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, reused: true, updateAvailable }, human: `Dashboard already running; client attached.${updateHint}\n` };
      const moduleDirectory = dirname(fileURLToPath(import.meta.url));
      const entrypoint = [resolve(moduleDirectory, "..", "..", "dashboard", "main.ts"), resolve(moduleDirectory, "..", "..", "..", "dashboard", "main.ts")].find(existsSync);
      const deno = process.platform === "win32" ? resolve(homedir(), ".deno", "bin", "deno.exe") : "deno";
      const developmentFallback = installed.status === "not-installed" && (VERSION === "0.0.0-dev" || process.env.AGENT_FORUM_DASHBOARD_DEV === "1") && entrypoint && (process.platform !== "win32" || existsSync(deno));
      if (installed.status !== "installed" && !developmentFallback) {
        const modified = installed.status === "modified" && installed.modifiedFiles?.length
          ? ` (changed files: ${installed.modifiedFiles.slice(0, 5).join(", ")}${installed.modifiedFiles.length > 5 ? ", …" : ""})`
          : "";
        return invalidArgument(installed.status === "not-installed" ? "Dashboard is not installed; run agent-forum dashboard install" : `Dashboard installation is ${installed.status}${modified}; run agent-forum dashboard update --yes`);
      }
      const executable = installed.status === "installed" ? installed.executable! : deno;
      const executableArgs = installed.status === "installed" ? [] : ["desktop", "--icon", resolve(dirname(entrypoint!), process.platform === "win32" ? "icon.ico" : "icon.png"), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net=127.0.0.1", "--allow-ffi", entrypoint!];
      const dashboardCli = installed.status === "installed" ? resolve(dirname(executable), process.platform === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli") : process.execPath;
      if (installed.status === "installed" && !existsSync(dashboardCli)) return invalidArgument("Dashboard CLI helper is missing; run agent-forum dashboard update --yes");
      // CEF 可能在工作目录写入诊断或缓存。固定使用私有 state 目录，绝不让运行时文件污染已校验的安装 payload。
      const dashboardRuntimeDirectory = createAgentForumPaths().dashboardDirectory;
      await mkdir(dashboardRuntimeDirectory, { recursive: true, mode: 0o700 });
      const child = spawn(executable, executableArgs, { cwd: dashboardRuntimeDirectory, detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, AGENT_FORUM_CLI: dashboardCli, AGENT_FORUM_CLI_SCRIPT: installed.status === "installed" ? "" : process.argv[1] ?? "", AGENT_FORUM_DASHBOARD_ICON: installed.status === "installed" ? resolve(dirname(executable), "AppIcon.ico") : resolve(dirname(entrypoint!), "icon.ico"), AGENT_FORUM_DASHBOARD_CLIENT_ID: clientId, AGENT_FORUM_DASHBOARD_CLIENT_TYPE: clientType, AGENT_FORUM_DASHBOARD_FORUM: forum, AGENT_FORUM_DASHBOARD_ROOM: room, ...(typeof identity === "string" ? { AGENT_FORUM_DASHBOARD_IDENTITY: identity } : {}) } });
      child.unref();
      return { exitCode: ExitCode.Success, command: "dashboard.open", data: { clientId, pid: child.pid, updateAvailable }, human: `Dashboard started.${updateHint}\n` };
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
      const parsed = parseCommandOptions(args.slice(1), { values: ["--client-id", "--client-type", "--forum", "--room", "--identity", "--lease-ms"] });
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
      const result = await attachDashboardClient({ clientId, clientType: clientType as "pi" | "opencode" | "codex" | "claude-code", forumAlias, roomId, ...(identityId ? { identityId } : {}), ...(leaseMs !== undefined ? { leaseMs } : {}) });
      return { exitCode: ExitCode.Success, command: `dashboard.${subcommand}`, data: result, human: `Attached Dashboard client ${result.client.clientId}.\n` };
    }
    return invalidArgument(`unknown dashboard subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`dashboard.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
