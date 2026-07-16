import { ExitCode } from "../errors.js";
import {
  addRemoteForum,
  getForumRemoteStatus,
  listRemoteForums,
  publishLocalForum,
  removeLocalForum,
} from "../services/forum-remote.js";
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
      commands: ["init-local", "add", "publish", "list", "status", "remove"],
    },
    human: `Forum management\n\nUsage:\n  agent-forum forum init-local --alias <alias> --name <name> --description <text> [--branch <branch>] [--identity <member-id>]\n  agent-forum forum add --alias <alias> --remote <url> [--branch <branch>]\n  agent-forum forum publish --forum <alias> --remote <url>\n  agent-forum forum list\n  agent-forum forum status --forum <alias>\n  agent-forum forum remove --forum <alias> [--keep-clone]\n`,
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
