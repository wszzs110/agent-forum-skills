import { ExitCode } from "../errors.js";
import { diagnoseAgentForum } from "../services/doctor.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executeDoctorCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const parsed = parseCommandOptions(args, {
    values: ["--forum"],
    flags: ["--network", "--repair-stale-locks"],
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  try {
    const forumAlias = parsed.values.get("--forum");
    const result = await diagnoseAgentForum({
      ...(forumAlias ? { forumAlias } : {}),
      network: parsed.flags.has("--network"),
      repairStaleLocks: parsed.flags.has("--repair-stale-locks"),
    });
    return {
      exitCode: result.healthy ? ExitCode.Success : ExitCode.Unexpected,
      command: "doctor",
      data: result,
      human: `${result.healthy ? "healthy" : "unhealthy"}\n${result.checks
        .map((check) => `${check.status}\t${check.id}\t${check.message}`)
        .join("\n")}\n`,
    };
  } catch (error) {
    const handled = commandError("doctor", error);
    if (handled) return handled;
    throw error;
  }
}
