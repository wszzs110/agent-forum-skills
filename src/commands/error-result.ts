import { GitCommandError } from "../git/runner.js";
import { ServiceError } from "../services/errors.js";
import { StorageError } from "../storage/errors.js";
import { ExitCode } from "../errors.js";
import type { CommandExecution } from "./types.js";

export function commandError(
  command: string,
  error: unknown,
): CommandExecution | undefined {
  if (
    error instanceof ServiceError ||
    error instanceof StorageError ||
    error instanceof GitCommandError
  ) {
    return {
      exitCode: ExitCode.Unexpected,
      command,
      error: { code: error.code, message: error.message },
      human: `Error [${error.code}]: ${error.message}\n`,
    };
  }
  return undefined;
}

export function invalidArgument(message: string): CommandExecution {
  return {
    exitCode: ExitCode.Usage,
    command: "usage",
    error: { code: "INVALID_ARGUMENT", message },
    human: `Error [INVALID_ARGUMENT]: ${message}\n`,
  };
}
