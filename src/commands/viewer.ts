import { ExitCode } from "../errors.js";
import { createAgentForumPaths } from "../storage/paths.js";
import { cleanViewerSessions, closeViewerSession, generateViewerHtml, listViewerSessions, openViewer, runViewerServer } from "../services/viewer.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executeViewerCommand(args: readonly string[]): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "viewer.help",
      data: { usage: "agent-forum viewer <open|generate|status|close|clean> [options]" },
      human: "Viewer\n\nUsage:\n  agent-forum viewer open [--forum <alias> --room <room>] [--no-sync] [--no-open]\n  agent-forum viewer generate [--forum <alias> --room <room>] [--output <file>]\n  agent-forum viewer status\n  agent-forum viewer close [--session <id>]\n  agent-forum viewer clean\n",
    };
  }
  if (!["open", "generate", "status", "close", "clean", "serve"].includes(subcommand)) {
    return invalidArgument(`unknown viewer subcommand: ${subcommand}`);
  }
  try {
    if (subcommand === "status") {
      if (args.length !== 1) return invalidArgument("viewer status accepts no options");
      const sessions = await listViewerSessions();
      return { exitCode: ExitCode.Success, command: "viewer.status", data: { sessions }, human: sessions.length ? sessions.map((session) => `${session.sessionId}\t${session.forumAlias}\t${session.url}`).join("\n") + "\n" : "No active Viewer sessions.\n" };
    }
    if (subcommand === "clean") {
      if (args.length !== 1) return invalidArgument("viewer clean accepts no options");
      const result = await cleanViewerSessions();
      return { exitCode: ExitCode.Success, command: "viewer.clean", data: result, human: `Removed ${result.removed} stale Viewer entries.\n` };
    }
    if (subcommand === "close") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--session"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await closeViewerSession(parsed.values.get("--session"));
      return { exitCode: ExitCode.Success, command: "viewer.close", data: result, human: `Closed ${result.closed.length} Viewer session(s).\n` };
    }
    if (subcommand === "serve") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--forum", "--room", "--session", "--token", "--idle-ms", "--home"], flags: ["--no-sync"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = parsed.values.get("--forum");
      const room = parsed.values.get("--room");
      const sessionId = parsed.values.get("--session");
      const token = parsed.values.get("--token");
      const idleMs = Number(parsed.values.get("--idle-ms"));
      if (!forumAlias || !room || !sessionId || !token || !Number.isInteger(idleMs) || idleMs < 1000) return invalidArgument("invalid internal Viewer server arguments");
      const home = parsed.values.get("--home");
      await runViewerServer({ forumAlias, room, sessionId, token, idleMs, sync: !parsed.flags.has("--no-sync") }, createAgentForumPaths(home));
      return { exitCode: ExitCode.Success, command: "viewer.serve", data: {}, human: "" };
    }
    const parsed = parseCommandOptions(args.slice(1), {
      values: ["--forum", "--room", "--output"],
      flags: ["--no-sync", "--no-open"],
    });
    if ("error" in parsed) return invalidArgument(parsed.error);
    const forumAlias = parsed.values.get("--forum");
    const room = parsed.values.get("--room");
    if (Boolean(forumAlias) !== Boolean(room)) return invalidArgument("--forum and --room must be provided together");
    if (subcommand === "generate") {
      if (parsed.flags.size > 0) return invalidArgument("viewer generate does not accept --no-sync or --no-open");
      const output = parsed.values.get("--output");
      const result = await generateViewerHtml({ ...(forumAlias ? { forumAlias } : {}), ...(room ? { room } : {}), ...(output ? { output } : {}) });
      return { exitCode: ExitCode.Success, command: "viewer.generate", data: result, human: `Generated ${result.output}\n` };
    }
    if (parsed.values.has("--output")) return invalidArgument("viewer open does not accept --output");
    const result = await openViewer({ ...(forumAlias ? { forumAlias } : {}), ...(room ? { room } : {}), sync: !parsed.flags.has("--no-sync"), openBrowser: !parsed.flags.has("--no-open") });
    return { exitCode: ExitCode.Success, command: "viewer.open", data: result, human: `${result.url}\n${result.browserOpened ? "Opened in the default browser." : "Open this URL manually."}${result.replacedSessionIds.length ? `\nReplaced ${result.replacedSessionIds.length} existing Viewer session(s) for this Forum Room.` : ""}\n` };
  } catch (error) {
    const handled = commandError(`viewer.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
