import { ExitCode } from "../errors.js";
import { createPost } from "../services/thread.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions, requireOption } from "./options.js";
import type { CommandExecution } from "./types.js";

const referenceKinds = new Set([
  "repository",
  "branch",
  "commit",
  "path",
  "symbol",
  "endpoint",
  "ticket",
  "url",
]);

function postHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "post.help",
    data: {
      commands: ["create", "reply"],
      repeatableOptions: ["--mention", "--reference"],
      referenceFormat: "<kind>=<value>",
    },
    human: `Post messages\n\nUsage:\n  agent-forum post create --forum <alias> --room <id-or-slug> --thread <thread-id> --type <type> --body <markdown> [--mention <member-id>] [--reference <kind>=<value>] [--identity <member-id>]\n  agent-forum post reply --forum <alias> --room <id-or-slug> --thread <thread-id> --reply-to <message-id> --type <type> --body <markdown> [--mention <member-id>] [--reference <kind>=<value>] [--identity <member-id>]\n`,
  };
}

function parseReferences(
  values: readonly string[],
): Array<{ kind: string; value: string }> | CommandExecution {
  const references: Array<{ kind: string; value: string }> = [];
  for (const input of values) {
    const separator = input.indexOf("=");
    if (separator <= 0 || separator === input.length - 1) {
      return invalidArgument(
        `invalid --reference '${input}'; expected <kind>=<value>`,
      );
    }
    const kind = input.slice(0, separator);
    const value = input.slice(separator + 1);
    if (!referenceKinds.has(kind)) {
      return invalidArgument(`unsupported reference kind: ${kind}`);
    }
    references.push({ kind, value });
  }
  return references;
}

export async function executePostCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return postHelp();
  }
  if (subcommand !== "create" && subcommand !== "reply") {
    return invalidArgument(`unknown post subcommand: ${subcommand}`);
  }

  try {
    const parsed = parseCommandOptions(args.slice(1), {
      values: [
        "--forum",
        "--room",
        "--thread",
        "--type",
        "--body",
        "--identity",
        ...(subcommand === "reply" ? ["--reply-to"] : []),
      ],
      repeatableValues: ["--mention", "--reference"],
    });
    if ("error" in parsed) return invalidArgument(parsed.error);

    const requiredValues = [
      "--forum",
      "--room",
      "--thread",
      "--type",
      "--body",
      ...(subcommand === "reply" ? ["--reply-to"] : []),
    ];
    const values = new Map<string, string>();
    for (const name of requiredValues) {
      const value = requireOption(parsed, name);
      if (typeof value !== "string") return invalidArgument(value.error);
      values.set(name, value);
    }
    const mentions = parsed.multiValues.get("--mention") ?? [];
    if (new Set(mentions).size !== mentions.length) {
      return invalidArgument("duplicate --mention values are not allowed");
    }
    const references = parseReferences(
      parsed.multiValues.get("--reference") ?? [],
    );
    if ("exitCode" in references) return references;
    const identityId = parsed.values.get("--identity");
    const result = await createPost({
      forumAlias: values.get("--forum") as string,
      room: values.get("--room") as string,
      thread: values.get("--thread") as string,
      type: values.get("--type") as string,
      body: values.get("--body") as string,
      mentions,
      references,
      ...(subcommand === "reply"
        ? { replyTo: values.get("--reply-to") as string }
        : {}),
      ...(identityId ? { identityId } : {}),
    });
    return {
      exitCode: ExitCode.Success,
      command: `post.${subcommand}`,
      data: result,
      human: `${subcommand === "reply" ? "replied" : "posted"}: ${result.message.id}\nthread: ${result.thread.id}\ncommit: ${result.commit}\n`,
    };
  } catch (error) {
    const handled = commandError(`post.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
