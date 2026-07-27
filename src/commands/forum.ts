import { ExitCode } from "../errors.js";
import {
  closeConflict,
  getConflict,
  listConflicts,
  prepareConflictReissue,
} from "../services/conflicts.js";
import {
  createForumEvent,
  showForum,
} from "../services/forum-lifecycle.js";
import {
  addRemoteForum,
  getForumRemoteStatus,
  listRemoteForums,
  publishLocalForum,
  removeLocalForum,
} from "../services/forum-remote.js";
import { syncForum } from "../services/forum-sync.js";
import { initLocalForum } from "../services/local-forum.js";
import { commandError, invalidArgument } from "./error-result.js";
import {
  parseCommandOptions,
  requireOption,
  type ParsedCommandOptions,
} from "./options.js";
import type { CommandExecution } from "./types.js";

function forumHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "forum.help",
    data: {
      commands: [
        "init-local",
        "add",
        "publish",
        "list",
        "status",
        "show",
        "rename",
        "set-description",
        "archive",
        "restore",
        "sync",
        "conflict",
        "remove",
      ],
    },
    human: `Forum management\n\nUsage:\n  agent-forum forum init-local --alias <alias> --name <name> --description <text> [--branch <branch>] [--identity <member-id>]\n  agent-forum forum add --alias <alias> --remote <url> [--branch <branch>]\n  agent-forum forum publish --forum <alias> --remote <url>\n  agent-forum forum list\n  agent-forum forum status --forum <alias>\n  agent-forum forum show --forum <alias>\n  agent-forum forum rename --forum <alias> --name <name> --reason <reason>\n  agent-forum forum set-description --forum <alias> --description <text> --reason <reason>\n  agent-forum forum archive|restore --forum <alias> --reason <reason>\n  agent-forum forum sync --forum <alias>\n  agent-forum forum conflict list|show|retry|prepare-reissue|close ...\n  agent-forum forum remove --forum <alias> [--keep-clone]\n`,
  };
}

function valueOrError(
  parsed: ParsedCommandOptions,
  name: string,
): string | CommandExecution {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}

export async function executeForumCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return forumHelp();
  }

  try {
    if (subcommand === "init-local") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--alias", "--name", "--description", "--branch", "--identity"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const alias = valueOrError(parsed, "--alias");
      if (typeof alias !== "string") return alias;
      const name = valueOrError(parsed, "--name");
      if (typeof name !== "string") return name;
      const description = valueOrError(parsed, "--description");
      if (typeof description !== "string") return description;
      const identityId = parsed.values.get("--identity");
      const result = await initLocalForum({
        alias,
        name,
        description,
        dataBranch: parsed.values.get("--branch") ?? "main",
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.init-local",
        data: result,
        human: `initialized: ${result.alias}\npath: ${result.path}\nforum: ${result.forumId}\ncommit: ${result.commit}\n`,
      };
    }

    if (subcommand === "add") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--alias", "--remote", "--branch"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const alias = valueOrError(parsed, "--alias");
      if (typeof alias !== "string") return alias;
      const remote = valueOrError(parsed, "--remote");
      if (typeof remote !== "string") return remote;
      const branch = parsed.values.get("--branch");
      const result = await addRemoteForum({
        alias,
        remote,
        ...(branch ? { branch } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.add",
        data: result,
        human: `added: ${result.alias}\nforum: ${result.forumId}\nbranch: ${result.dataBranch}\nremote: ${result.remote}\n`,
      };
    }

    if (subcommand === "publish") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--remote"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const remote = valueOrError(parsed, "--remote");
      if (typeof remote !== "string") return remote;
      const result = await publishLocalForum({ forumAlias, remote });
      return {
        exitCode: ExitCode.Success,
        command: "forum.publish",
        data: result,
        human: `published: ${result.forumAlias}\nbranch: ${result.branch}\nremote: ${result.remote}\ncommit: ${result.commit}\n`,
      };
    }

    if (subcommand === "list") {
      const parsed = parseCommandOptions(args.slice(1), { values: [] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await listRemoteForums();
      return {
        exitCode: ExitCode.Success,
        command: "forum.list",
        data: result,
        human:
          result.forums.length === 0
            ? "No forums.\n"
            : `${result.forums
                .map(
                  (forum) =>
                    `${forum.alias}\t${forum.health}\t${forum.expectedBranch}\t${forum.remote.displayUrl ?? "no-remote"}`,
                )
                .join("\n")}\n`,
      };
    }

    if (subcommand === "status") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await getForumRemoteStatus(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.status",
        data: result,
        human: `forum: ${result.alias}\nhealth: ${result.health}\nbranch: ${result.currentBranch ?? "detached"}\nremote: ${result.remote.displayUrl ?? "not configured"}\nahead: ${result.remote.ahead ?? "unknown"}\nbehind: ${result.remote.behind ?? "unknown"}\n`,
      };
    }

    if (subcommand === "show") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--forum"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await showForum(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.show",
        data: result,
        human: `${result.forum.name}\nstatus: ${result.forum.status}\n${result.forum.description}\n`,
      };
    }

    if (["rename", "set-description", "archive", "restore"].includes(subcommand)) {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--name", "--description", "--reason", "--identity"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const reason = valueOrError(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const name = parsed.values.get("--name");
      const description = parsed.values.get("--description");
      if (subcommand === "rename" && !name) return invalidArgument("--name is required");
      if (subcommand === "set-description" && !description) return invalidArgument("--description is required");
      const type = subcommand === "rename"
        ? "forum-renamed"
        : subcommand === "set-description"
          ? "forum-description-changed"
          : subcommand === "archive"
            ? "forum-archived"
            : "forum-restored";
      const data = name ? { name } : description ? { description } : {};
      const identityId = parsed.values.get("--identity");
      const result = await createForumEvent({
        forumAlias,
        type,
        reason,
        data,
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: `forum.${subcommand}`,
        data: result,
        human: `${type}: ${result.forum.forumId}\ncommit: ${result.commit}\n`,
      };
    }

    if (subcommand === "sync") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await syncForum(forumAlias);
      return {
        exitCode: ExitCode.Success,
        command: "forum.sync",
        data: result,
        human: `forum: ${result.forumAlias}\noutcome: ${result.outcome}\nhead: ${result.finalHead}\nfetches: ${result.fetches}\npush attempts: ${result.pushAttempts}\n${result.warnings.length ? `warnings: ${result.warnings.length} malformed remote record(s) were isolated\n` : ""}`,
      };
    }

    if (subcommand === "conflict") {
      const action = args[1];
      if (!action || !["list", "show", "retry", "prepare-reissue", "close"].includes(action)) {
        return invalidArgument("forum conflict requires list, show, retry, prepare-reissue, or close");
      }
      const parsed = parseCommandOptions(args.slice(2), {
        values: ["--forum", "--id"],
        flags: ["--confirm"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      if (action === "list") {
        const result = await listConflicts(forumAlias);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.list",
          data: result,
          human: result.conflicts.length === 0
            ? "No conflicts.\n"
            : `${result.conflicts.map((item) => `${item.operationId}\t${item.status}\t${item.createdAt}`).join("\n")}\n`,
        };
      }
      const operationId = valueOrError(parsed, "--id");
      if (typeof operationId !== "string") return operationId;
      if (action === "show") {
        const result = await getConflict(forumAlias, operationId);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.show",
          data: result,
          human: `conflict: ${result.operationId}\nstatus: ${result.status}\npaths: ${result.conflicts.join(", ")}\nrecovery: ${result.recoveryRef}\n`,
        };
      }
      if (action === "retry") {
        const result = await syncForum(forumAlias);
        await closeConflict(forumAlias, operationId);
        return {
          exitCode: ExitCode.Success,
          command: "forum.conflict.retry",
          data: result,
          human: `resolved by retry: ${operationId}\noutcome: ${result.outcome}\n`,
        };
      }
      if (!parsed.flags.has("--confirm")) {
        return invalidArgument(`${action} requires --confirm`);
      }
      const result = action === "prepare-reissue"
        ? await prepareConflictReissue(forumAlias, operationId)
        : await closeConflict(forumAlias, operationId);
      return {
        exitCode: ExitCode.Success,
        command: `forum.conflict.${action}`,
        data: result,
        human: `${action}: ${operationId}\n`,
      };
    }

    if (subcommand === "remove") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum"],
        flags: ["--keep-clone"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const result = await removeLocalForum({
        forumAlias,
        keepClone: parsed.flags.has("--keep-clone"),
      });
      return {
        exitCode: ExitCode.Success,
        command: "forum.remove",
        data: result,
        human: `removed: ${result.forumAlias}\nlocal clone: ${result.clone}\nremote: unchanged\n`,
      };
    }

    return invalidArgument(`unknown forum subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`forum.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
