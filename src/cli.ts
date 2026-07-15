import { executeSkillCommand } from "./commands/skill.js";
import { ExitCode, type ExitCodeValue } from "./errors.js";
import { failure, success } from "./output/result.js";
import { CLI_NAME, PACKAGE_NAME, VERSION } from "./version.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const helpText = `agent-forum — Git-based collaboration for software development agents

Usage:
  agent-forum [--json] <command>

Commands:
  help, --help       Show this help message
  version, --version Show the CLI version
  skill              Install, inspect, diagnose, or uninstall the Agent Skill

Options:
  --json             Emit a stable machine-readable result
`;

function writeJson(io: CliIo, value: unknown): void {
  io.stdout(`${JSON.stringify(value)}\n`);
}

export async function runCli(
  args: readonly string[],
  io: CliIo = defaultIo,
): Promise<ExitCodeValue> {
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  const command = positional[0];

  if (
    command === undefined ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    if (json) {
      writeJson(
        io,
        success("help", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION,
          usage: "agent-forum [--json] <command>",
          commands: ["help", "version", "skill"],
        }),
      );
    } else {
      io.stdout(helpText);
    }
    return ExitCode.Success;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    if (json) {
      writeJson(
        io,
        success("version", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION,
        }),
      );
    } else {
      io.stdout(`${CLI_NAME} ${VERSION}\n`);
    }
    return ExitCode.Success;
  }

  if (command === "skill") {
    try {
      const execution = await executeSkillCommand(positional.slice(1));
      if (json) {
        writeJson(
          io,
          execution.error
            ? failure(execution.error.code, execution.error.message)
            : success(execution.command, execution.data),
        );
      } else if (execution.error) {
        io.stderr(execution.human);
      } else {
        io.stdout(execution.human);
      }
      return execution.exitCode;
    } catch {
      const unexpected = failure(
        "UNEXPECTED_ERROR",
        "The skill operation failed unexpectedly. Run with a trusted package and check filesystem permissions.",
      );
      if (json) writeJson(io, unexpected);
      else io.stderr(`Error [${unexpected.error.code}]: ${unexpected.error.message}\n`);
      return ExitCode.Unexpected;
    }
  }

  const result = failure(
    "UNKNOWN_COMMAND",
    `Unknown command: ${command}. Run '${CLI_NAME} --help' for usage.`,
  );

  if (json) {
    writeJson(io, result);
  } else {
    io.stderr(`Error [${result.error.code}]: ${result.error.message}\n`);
  }
  return ExitCode.Usage;
}
