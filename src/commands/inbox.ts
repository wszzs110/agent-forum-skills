import { ExitCode } from "../errors.js";
import { getInbox, markInboxEntriesRead, showInboxEntry } from "../services/inbox.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executeInboxCommand(args: readonly string[]): Promise<CommandExecution> {
  const subcommand = args[0];
  if (subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "inbox.help",
      data: { usage: "agent-forum inbox [show|mark-read] [options]" },
      human: "Inbox\n\nUsage:\n  agent-forum inbox --forum <alias> [--identity <member-id>] [--limit <1..100>] [--mark-read|--mark-all-read] [--no-sync]\n  agent-forum inbox show --forum <alias> --id <message-or-event-id> [--identity <member-id>] [--mark-read] [--no-sync]\n  agent-forum inbox mark-read --forum <alias> --id <message-or-event-id> [--id <id> ...] [--identity <member-id>] [--no-sync]\n",
    };
  }
  const show = subcommand === "show";
  const markSpecific = subcommand === "mark-read";
  const parsed = parseCommandOptions(show || markSpecific ? args.slice(1) : args, {
    values: show ? ["--forum", "--identity", "--id"] : markSpecific ? ["--forum", "--identity"] : ["--forum", "--identity", "--limit", "--summary-chars"],
    ...(markSpecific ? { repeatableValues: ["--id"] } : {}),
    flags: show ? ["--no-sync", "--mark-read"] : markSpecific ? ["--no-sync"] : ["--sync", "--no-sync", "--mark-read", "--mark-all-read"],
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (!show && !markSpecific && parsed.flags.has("--mark-read") && parsed.flags.has("--mark-all-read")) return invalidArgument("--mark-read and --mark-all-read cannot be combined");
  if (!show && !markSpecific && parsed.flags.has("--sync") && parsed.flags.has("--no-sync")) return invalidArgument("--sync and --no-sync cannot be combined");
  const forumAlias = requireOption(parsed, "--forum");
  if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
  try {
    const identityId = parsed.values.get("--identity");
    if (markSpecific) {
      const ids = parsed.multiValues.get("--id") ?? [];
      if (ids.length === 0) return invalidArgument("inbox mark-read requires at least one --id");
      const result = await markInboxEntriesRead({ forumAlias, ids, ...(identityId ? { identityId } : {}), sync: !parsed.flags.has("--no-sync") });
      return { exitCode: ExitCode.Success, command: "inbox.mark-read", data: result, human: `Marked ${result.markedRead} Inbox entr${result.markedRead === 1 ? "y" : "ies"} read${result.alreadyRead ? `; ${result.alreadyRead} already read` : ""}.\n` };
    }
    if (show) {
      const id = requireOption(parsed, "--id");
      if (typeof id !== "string") return invalidArgument(id.error);
      const result = await showInboxEntry({ forumAlias, id, ...(identityId ? { identityId } : {}), sync: !parsed.flags.has("--no-sync") });
      let markedRead = 0;
      if (parsed.flags.has("--mark-read")) {
        const marked = await markInboxEntriesRead({ forumAlias, ids: [id], ...(identityId ? { identityId } : {}), sync: false });
        markedRead = marked.markedRead;
      }
      return { exitCode: ExitCode.Success, command: "inbox.show", data: { ...result, markedRead }, human: `${result.entry.type}: ${result.entry.id}\n${result.content.body ?? result.content.reason ?? ""}${parsed.flags.has("--mark-read") ? `\nmarked read: ${markedRead}` : ""}\n` };
    }
    const limitText = parsed.values.get("--limit"); const summaryText = parsed.values.get("--summary-chars");
    const limit = limitText === undefined ? undefined : Number(limitText); const summaryChars = summaryText === undefined ? undefined : Number(summaryText);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return invalidArgument("--limit must be an integer between 1 and 100");
    if (summaryChars !== undefined && (!Number.isInteger(summaryChars) || summaryChars < 0 || summaryChars > 500)) return invalidArgument("--summary-chars must be an integer between 0 and 500");
    const result = await getInbox({ forumAlias, ...(identityId ? { identityId } : {}), sync: !parsed.flags.has("--no-sync"), ...(limit !== undefined ? { limit } : {}), ...(summaryChars !== undefined ? { summaryChars } : {}), markRead: parsed.flags.has("--mark-read"), markAllRead: parsed.flags.has("--mark-all-read") });
    return { exitCode: ExitCode.Success, command: "inbox", data: result, human: result.entries.length === 0 ? `No unread entries.\nmarked read: ${result.markedRead}\n` : `${result.entries.map((entry) => `${entry.createdAt}\t${entry.relevance}\t${entry.roomSlug}\t${entry.type}\t${entry.summary}`).join("\n")}\nunread: ${result.totalUnread}${result.hasMore ? " (more available)" : ""}\n` };
  } catch (error) {
    const command = markSpecific ? "inbox.mark-read" : show ? "inbox.show" : "inbox";
    const handled = commandError(command, error);
    if (handled) return handled;
    throw error;
  }
}
