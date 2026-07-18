import { ExitCode } from "../errors.js";
import { getInbox, showInboxEntry } from "../services/inbox.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executeInboxCommand(args: readonly string[]): Promise<CommandExecution> {
  const show = args[0] === "show";
  const parsed = parseCommandOptions(show ? args.slice(1) : args, {
    values: show ? ["--forum", "--identity", "--id"] : ["--forum", "--identity", "--limit", "--summary-chars"],
    flags: show ? [] : ["--sync", "--mark-read", "--mark-all-read"],
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (!show && parsed.flags.has("--mark-read") && parsed.flags.has("--mark-all-read")) return invalidArgument("--mark-read and --mark-all-read cannot be combined");
  const forumAlias = requireOption(parsed, "--forum");
  if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
  try {
    const identityId = parsed.values.get("--identity");
    if (show) {
      const id = requireOption(parsed, "--id");
      if (typeof id !== "string") return invalidArgument(id.error);
      const result = await showInboxEntry({ forumAlias, id, ...(identityId ? { identityId } : {}) });
      return { exitCode: ExitCode.Success, command: "inbox.show", data: result, human: `${result.entry.type}: ${result.entry.id}\n${result.content.body ?? result.content.reason ?? ""}\n` };
    }
    const limitText = parsed.values.get("--limit"); const summaryText = parsed.values.get("--summary-chars");
    const limit = limitText === undefined ? undefined : Number(limitText); const summaryChars = summaryText === undefined ? undefined : Number(summaryText);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return invalidArgument("--limit must be an integer between 1 and 100");
    if (summaryChars !== undefined && (!Number.isInteger(summaryChars) || summaryChars < 0 || summaryChars > 500)) return invalidArgument("--summary-chars must be an integer between 0 and 500");
    const result = await getInbox({ forumAlias, ...(identityId ? { identityId } : {}), sync: parsed.flags.has("--sync"), ...(limit !== undefined ? { limit } : {}), ...(summaryChars !== undefined ? { summaryChars } : {}), markRead: parsed.flags.has("--mark-read"), markAllRead: parsed.flags.has("--mark-all-read") });
    return { exitCode: ExitCode.Success, command: "inbox", data: result, human: result.entries.length === 0 ? `No unread entries.\nmarked read: ${result.markedRead}\n` : `${result.entries.map((entry) => `${entry.createdAt}\t${entry.relevance}\t${entry.roomSlug}\t${entry.type}\t${entry.summary}`).join("\n")}\nunread: ${result.totalUnread}${result.hasMore ? " (more available)" : ""}\n` };
  } catch (error) { const handled = commandError(show ? "inbox.show" : "inbox", error); if (handled) return handled; throw error; }
}
