import { ExitCode } from "../errors.js";
import { getInbox } from "../services/inbox.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executeInboxCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const parsed = parseCommandOptions(args, {
    values: ["--forum", "--identity", "--limit"],
    flags: ["--sync", "--mark-read", "--mark-all-read"],
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (parsed.flags.has("--mark-read") && parsed.flags.has("--mark-all-read")) {
    return invalidArgument("--mark-read and --mark-all-read cannot be combined");
  }
  const forumAlias = requireOption(parsed, "--forum");
  if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
  const limitText = parsed.values.get("--limit");
  const limit = limitText === undefined ? undefined : Number(limitText);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    return invalidArgument("--limit must be an integer between 1 and 100");
  }
  try {
    const identityId = parsed.values.get("--identity");
    const result = await getInbox({
      forumAlias,
      ...(identityId ? { identityId } : {}),
      sync: parsed.flags.has("--sync"),
      ...(limit !== undefined ? { limit } : {}),
      markRead: parsed.flags.has("--mark-read"),
      markAllRead: parsed.flags.has("--mark-all-read"),
    });
    return {
      exitCode: ExitCode.Success,
      command: "inbox",
      data: result,
      human: result.entries.length === 0
        ? `No unread entries.\nmarked read: ${result.markedRead}\n`
        : `${result.entries
            .map((entry) => `${entry.createdAt}\t${entry.roomSlug}\t${entry.type}\t${entry.summary}`)
            .join("\n")}\nunread: ${result.totalUnread}${result.hasMore ? " (more available)" : ""}\n`,
    };
  } catch (error) {
    const handled = commandError("inbox", error);
    if (handled) return handled;
    throw error;
  }
}
