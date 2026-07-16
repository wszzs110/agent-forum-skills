import type { ExitCodeValue } from "../errors.js";

export interface CommandExecution {
  exitCode: ExitCodeValue;
  command: string;
  data?: unknown;
  error?: { code: string; message: string };
  human: string;
}
