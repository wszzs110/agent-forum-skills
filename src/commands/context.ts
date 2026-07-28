import { ExitCode } from "../errors.js";
import {
  bindContext,
  listContextBindings,
  resolveContext,
  showContext,
  unbindContext,
} from "../services/context.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

function contextHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "context.help",
    data: {
      commands: ["bind", "unbind", "show", "list", "resolve"],
    },
    human: `Context binding\n\nUsage:\n  agent-forum context bind --forum <alias> --room <id-or-slug> [--cwd <path>] [--branch <name> | --workspace] [--force]\n  agent-forum context unbind [--cwd <path>] [--branch <name> | --workspace]\n  agent-forum context show [--cwd <path>]\n  agent-forum context list\n  agent-forum context resolve [--cwd <path>] [--forum <alias> --room <id-or-slug>]\n`,
  };
}

export async function executeContextCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return contextHelp();
  }

  try {
    if (subcommand === "bind") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--room", "--cwd", "--branch"],
        flags: ["--workspace", "--force"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.flags.has("--workspace") && parsed.values.has("--branch")) {
        return invalidArgument("--workspace and --branch cannot be combined");
      }
      const forumAlias = requireOption(parsed, "--forum");
      if (typeof forumAlias !== "string") return invalidArgument(forumAlias.error);
      const room = requireOption(parsed, "--room");
      if (typeof room !== "string") return invalidArgument(room.error);
      const cwd = parsed.values.get("--cwd");
      const branch = parsed.values.get("--branch");
      const result = await bindContext({
        forumAlias,
        room,
        workspace: parsed.flags.has("--workspace"),
        force: parsed.flags.has("--force"),
        ...(cwd ? { cwd } : {}),
        ...(branch ? { branch } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.bind",
        data: result,
        human: `${result.action}: ${result.binding.scope} context\nforum: ${result.target.forumAlias}\nroom: ${result.target.roomSlug}\n${result.target.deprecation ? `warning: Room deprecated by ${result.target.deprecation.changedBy.displayName}; consider ${result.target.deprecation.replacementRoomId ?? "confirming a replacement with the Forum"}\n` : ""}`,
      };
    }

    if (subcommand === "unbind") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--cwd", "--branch"],
        flags: ["--workspace"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      if (parsed.flags.has("--workspace") && parsed.values.has("--branch")) {
        return invalidArgument("--workspace and --branch cannot be combined");
      }
      const cwd = parsed.values.get("--cwd");
      const branch = parsed.values.get("--branch");
      const result = await unbindContext({
        workspace: parsed.flags.has("--workspace"),
        ...(cwd ? { cwd } : {}),
        ...(branch ? { branch } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.unbind",
        data: result,
        human:
          result.removed.length === 0
            ? "No matching binding.\n"
            : `removed: ${result.removed.length}\n`,
      };
    }

    if (subcommand === "show") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--cwd"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await showContext(parsed.values.get("--cwd"));
      return {
        exitCode: ExitCode.Success,
        command: "context.show",
        data: result,
        human: `source: ${result.source}\nforum: ${result.forumAlias}\nroom: ${result.roomSlug}\nstatus: ${result.targetStatus}\n`,
      };
    }

    if (subcommand === "list") {
      const parsed = parseCommandOptions(args.slice(1), { values: [] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const result = await listContextBindings();
      return {
        exitCode: ExitCode.Success,
        command: "context.list",
        data: result,
        human:
          result.bindings.length === 0
            ? "No context bindings.\n"
            : `${result.bindings
                .map(
                  (item) =>
                    `${item.binding.scope}\t${item.binding.workspaceRoot}\t${item.forumAlias ?? item.forumId}/${item.roomSlug ?? item.roomId}\t${item.targetStatus}`,
                )
                .join("\n")}\n`,
      };
    }

    if (subcommand === "resolve") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--cwd", "--forum", "--room"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = parsed.values.get("--forum");
      const room = parsed.values.get("--room");
      if (Boolean(forumAlias) !== Boolean(room)) {
        return invalidArgument("--forum and --room must be provided together");
      }
      const cwd = parsed.values.get("--cwd");
      const result = await resolveContext({
        ...(cwd ? { cwd } : {}),
        ...(forumAlias ? { forumAlias } : {}),
        ...(room ? { room } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "context.resolve",
        data: result,
        human: `source: ${result.source}\nforum: ${result.forumAlias}\nroom: ${result.roomSlug}\nstatus: ${result.targetStatus}\n${result.deprecation ? `warning: Room deprecated by ${result.deprecation.changedBy.displayName}; consider ${result.deprecation.replacementRoomId ?? "confirming a replacement with the Forum"}\n` : ""}`,
      };
    }

    return invalidArgument(`unknown context subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`context.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
