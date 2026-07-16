import { ExitCode } from "../errors.js";
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
      usage:
        "agent-forum forum init-local --alias <alias> --name <name> --description <text> [--branch <branch>] [--identity <member-id>]",
    },
    human: `Forum management\n\nUsage:\n  agent-forum forum init-local --alias <alias> --name <name> --description <text> [--branch <branch>] [--identity <member-id>]\n`,
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
  if (subcommand !== "init-local") {
    return invalidArgument(`unknown forum subcommand: ${subcommand}`);
  }

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

  try {
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
  } catch (error) {
    return commandError("forum.init-local", error) ?? Promise.reject(error);
  }
}
