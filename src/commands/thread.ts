import { ExitCode } from "../errors.js";
import {
  createThread,
  createThreadEvent,
  listThreads,
  showThread,
} from "../services/thread.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

function threadHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "thread.help",
    data: {
      commands: ["create", "list", "show", "rename", "close", "reopen"],
      kinds: [
        "discussion",
        "question",
        "proposal",
        "change",
        "blocker",
        "review",
        "status",
        "test-result",
      ],
    },
    human: `Thread management\n\nUsage:\n  agent-forum thread create --forum <alias> --room <id-or-slug> --kind <kind> --title <title> --body <markdown>\n  agent-forum thread list --forum <alias> --room <id-or-slug>\n  agent-forum thread show --forum <alias> --room <id-or-slug> --thread <thread-id>\n  agent-forum thread rename --forum <alias> --room <id-or-slug> --thread <thread-id> --title <title> --reason <reason>\n  agent-forum thread close|reopen --forum <alias> --room <id-or-slug> --thread <thread-id> --reason <reason>\n`,
  };
}

function required(
  parsed: ReturnType<typeof parseCommandOptions> & { error?: never },
  name: string,
): string | CommandExecution {
  const result = requireOption(parsed, name);
  return typeof result === "string" ? result : invalidArgument(result.error);
}

export async function executeThreadCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return threadHelp();
  }

  try {
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: [
          "--forum",
          "--room",
          "--kind",
          "--title",
          "--body",
          "--identity",
        ],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const kind = required(parsed, "--kind");
      if (typeof kind !== "string") return kind;
      const title = required(parsed, "--title");
      if (typeof title !== "string") return title;
      const body = required(parsed, "--body");
      if (typeof body !== "string") return body;
      const identityId = parsed.values.get("--identity");
      const result = await createThread({
        forumAlias,
        room,
        kind,
        title,
        body,
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "thread.create",
        data: result,
        human: `created: ${result.thread.title}\nthread: ${result.thread.id}\ncommit: ${result.commit}\n`,
      };
    }

    if (subcommand === "list") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--room"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const result = await listThreads(forumAlias, room);
      return {
        exitCode: ExitCode.Success,
        command: "thread.list",
        data: result,
        human:
          result.threads.length === 0
            ? "No threads.\n"
            : `${result.threads.map((thread) => `${thread.id}\t${thread.status}\t${thread.kind}\t${thread.title}`).join("\n")}\n`,
      };
    }

    if (subcommand === "show") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--room", "--thread"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const thread = required(parsed, "--thread");
      if (typeof thread !== "string") return thread;
      const result = await showThread(forumAlias, room, thread);
      return {
        exitCode: ExitCode.Success,
        command: "thread.show",
        data: result,
        human: `${result.thread.title}\nstatus: ${result.thread.status}\nkind: ${result.thread.kind}\nmessages: ${result.thread.messageCount}\n`,
      };
    }

    if (
      subcommand === "rename" ||
      subcommand === "close" ||
      subcommand === "reopen"
    ) {
      const parsed = parseCommandOptions(args.slice(1), {
        values: [
          "--forum",
          "--room",
          "--thread",
          "--reason",
          "--title",
          "--identity",
        ],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = required(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = required(parsed, "--room");
      if (typeof room !== "string") return room;
      const thread = required(parsed, "--thread");
      if (typeof thread !== "string") return thread;
      const reason = required(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const title = parsed.values.get("--title");
      if (subcommand === "rename" && !title) {
        return invalidArgument("--title is required");
      }
      const identityId = parsed.values.get("--identity");
      const type =
        subcommand === "rename"
          ? "thread-renamed"
          : subcommand === "close"
            ? "thread-closed"
            : "thread-reopened";
      const result = await createThreadEvent({
        forumAlias,
        room,
        thread,
        type,
        reason,
        data: title ? { title } : {},
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: `thread.${subcommand}`,
        data: result,
        human: `${type}: ${result.thread.id}\ncommit: ${result.commit}\n`,
      };
    }

    return invalidArgument(`unknown thread subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`thread.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
