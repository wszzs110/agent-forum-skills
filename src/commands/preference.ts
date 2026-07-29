import { ExitCode } from "../errors.js";
import { getUiLanguage, setUiLanguage } from "../services/ui-preferences.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions } from "./options.js";
import type { CommandExecution } from "./types.js";

export async function executePreferenceCommand(args: readonly string[]): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return { exitCode: ExitCode.Success, command: "preference.help", data: { usage: "agent-forum preference language [--value <en|zh>]" }, human: "Preferences\n\nUsage:\n  agent-forum preference language [--value <en|zh>]\n" };
  }
  if (subcommand !== "language") return invalidArgument(`unknown preference subcommand: ${subcommand}`);
  const parsed = parseCommandOptions(args.slice(1), { values: ["--value"] });
  if ("error" in parsed) return invalidArgument(parsed.error);
  try {
    const value = parsed.values.get("--value");
    if (!value) {
      const language = await getUiLanguage();
      return { exitCode: ExitCode.Success, command: "preference.language", data: { language }, human: `UI language: ${language}\n` };
    }
    if (value !== "en" && value !== "zh") return invalidArgument("--value must be en or zh");
    const result = await setUiLanguage(value);
    return { exitCode: ExitCode.Success, command: "preference.language", data: result, human: `UI language set to ${result.language}.\n` };
  } catch (error) {
    const handled = commandError("preference.language", error);
    if (handled) return handled;
    throw error;
  }
}
