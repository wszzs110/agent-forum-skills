import { ExitCode } from "../errors.js";
import {
  SkillInstallationError,
  doctorSkill,
  getSkillStatus,
  installSkill,
  uninstallSkill,
  isSkillTarget,
  type SkillTarget,
} from "../skill/installer.js";
import type { CommandExecution } from "./types.js";

interface ParsedOptions {
  target?: SkillTarget;
  scope: "user";
  dryRun: boolean;
  force: boolean;
}

interface ResolvedOptions extends ParsedOptions {
  target: SkillTarget;
}

function usageError(message: string): CommandExecution {
  return {
    exitCode: ExitCode.Usage,
    command: "skill",
    error: { code: "INVALID_ARGUMENT", message },
    human: `Error [INVALID_ARGUMENT]: ${message}\n`,
  };
}

function parseOptions(args: readonly string[]): ResolvedOptions | CommandExecution {
  const parsed: ParsedOptions = {
    scope: "user",
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (argument === "--force") {
      parsed.force = true;
      continue;
    }
    if (argument === "--target") {
      const value = args[index + 1];
      if (!value || !isSkillTarget(value)) {
        return usageError("--target must be a lowercase platform slug, for example pi or kimi-code");
      }
      parsed.target = value;
      index += 1;
      continue;
    }
    if (argument === "--scope") {
      const value = args[index + 1];
      if (value !== "user") {
        return usageError("only --scope user is supported in the technical preview");
      }
      index += 1;
      continue;
    }
    return usageError(`unknown skill option: ${argument}`);
  }

  if (!parsed.target) return usageError("--target is required");
  return { ...parsed, target: parsed.target };
}

export async function executeSkillCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "skill.help",
      data: {
        usage:
          "agent-forum skill <install|update|uninstall|status|doctor> --target <platform-or-standard-slug> [--scope user] [--dry-run] [--force]",
      },
      human: `Skill management\n\nUsage:\n  agent-forum skill <install|update|uninstall|status|doctor> --target <platform> [options]\n\nPreferred targets:\n  pi, opencode, codex, claude-code\nOther Skill Agents:\n  Any lowercase platform slug (for example kimi-code) uses the standard Agent Skills directory.\n\nOptions:\n  --scope user  Install for the current user (default)\n  --dry-run     Show changes without writing files\n  --force       Replace or remove modified managed files\n`,
    };
  }

  if (!["install", "update", "uninstall", "status", "doctor"].includes(subcommand)) {
    return usageError(`unknown skill subcommand: ${subcommand}`);
  }
  const options = parseOptions(args.slice(1));
  if ("exitCode" in options) return options;

  try {
    if (subcommand === "install" || subcommand === "update") {
      const result = await installSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: `skill.${subcommand}`,
        data: result,
        human: `${result.action}: ${result.destination}\nReload the agent to discover the skill.\n`,
      };
    }
    if (subcommand === "uninstall") {
      const result = await uninstallSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: "skill.uninstall",
        data: result,
        human: `${result.action}: ${result.destination}\n`,
      };
    }
    if (subcommand === "status") {
      const result = await getSkillStatus(options.target);
      return {
        exitCode: ExitCode.Success,
        command: "skill.status",
        data: result,
        human: `${result.status}: ${result.destination}\n`,
      };
    }

    const result = await doctorSkill(options.target);
    return {
      exitCode: result.ok ? ExitCode.Success : ExitCode.Unexpected,
      command: "skill.doctor",
      data: result,
      human: `${result.ok ? "healthy" : "unhealthy"}: ${result.installation.destination}\n`,
    };
  } catch (error) {
    if (error instanceof SkillInstallationError) {
      return {
        exitCode:
          error.code === "INVALID_TARGET" ? ExitCode.Usage : ExitCode.Unexpected,
        command: `skill.${subcommand}`,
        error: { code: error.code, message: error.message },
        human: `Error [${error.code}]: ${error.message}\n`,
      };
    }
    throw error;
  }
}
