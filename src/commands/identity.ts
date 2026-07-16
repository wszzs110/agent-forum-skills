import {
  createLocalIdentity,
  findIdentity,
  loadLocalConfig,
} from "../config/local-config.js";
import { ExitCode } from "../errors.js";
import { publishIdentity } from "../services/local-forum.js";
import { commandError, invalidArgument } from "./error-result.js";
import {
  parseCommandOptions,
  requireOption,
  type ParsedCommandOptions,
} from "./options.js";
import type { CommandExecution } from "./types.js";

function identityHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "identity.help",
    data: {
      commands: ["create", "show", "publish"],
    },
    human: `Identity management\n\nUsage:\n  agent-forum identity create --name <name> --role <role> --responsibility <text> [--client <client>] [--no-default]\n  agent-forum identity show [--id <member-id>]\n  agent-forum identity publish --forum <alias> [--id <member-id>]\n`,
  };
}

function valueOrError(
  parsed: ParsedCommandOptions,
  name: string,
): string | CommandExecution {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}

export async function executeIdentityCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return identityHelp();
  }

  try {
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--name", "--role", "--responsibility", "--client"],
        flags: ["--no-default"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const displayName = valueOrError(parsed, "--name");
      if (typeof displayName !== "string") return displayName;
      const role = valueOrError(parsed, "--role");
      if (typeof role !== "string") return role;
      const responsibility = valueOrError(parsed, "--responsibility");
      if (typeof responsibility !== "string") return responsibility;
      const client = parsed.values.get("--client");
      const result = await createLocalIdentity({
        displayName,
        role,
        responsibility,
        ...(client ? { client } : {}),
        setDefault: !parsed.flags.has("--no-default"),
      });
      return {
        exitCode: ExitCode.Success,
        command: "identity.create",
        data: result,
        human: `created: ${result.identity.memberId}\ndefault: ${result.defaultIdentityId}\n`,
      };
    }

    if (subcommand === "show") {
      const parsed = parseCommandOptions(args.slice(1), { values: ["--id"] });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const config = await loadLocalConfig();
      const identity = findIdentity(config, parsed.values.get("--id"));
      return {
        exitCode: ExitCode.Success,
        command: "identity.show",
        data: {
          identity,
          isDefault: config.defaultIdentityId === identity.memberId,
        },
        human: `${identity.displayName} (${identity.memberId})\nrole: ${identity.role}\nresponsibility: ${identity.responsibility}\n`,
      };
    }

    if (subcommand === "publish") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--id"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forum = valueOrError(parsed, "--forum");
      if (typeof forum !== "string") return forum;
      const result = await publishIdentity(
        forum,
        parsed.values.get("--id"),
      );
      return {
        exitCode: ExitCode.Success,
        command: "identity.publish",
        data: result,
        human: `${result.action}: ${result.identityId}\nforum: ${result.alias}\n`,
      };
    }

    return invalidArgument(`unknown identity subcommand: ${subcommand}`);
  } catch (error) {
    return commandError(`identity.${subcommand ?? "unknown"}`, error) ?? Promise.reject(error);
  }
}
