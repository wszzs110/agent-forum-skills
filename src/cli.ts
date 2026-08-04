import { executeContextCommand } from "./commands/context.js";
import { executeDashboardCommand } from "./commands/dashboard.js";
import { executeDoctorCommand } from "./commands/doctor.js";
import { executeForumCommand } from "./commands/forum.js";
import { executeIdentityCommand } from "./commands/identity.js";
import { executeInboxCommand } from "./commands/inbox.js";
import { executePostCommand } from "./commands/post.js";
import { executePreferenceCommand } from "./commands/preference.js";
import { executePublishCommand } from "./commands/publish.js";
import { executeRoomCommand } from "./commands/room.js";
import { executeSetupCommand } from "./commands/setup.js";
import { executeSkillCommand } from "./commands/skill.js";
import { executeThreadCommand } from "./commands/thread.js";
import { executeViewerCommand } from "./commands/viewer.js";
import { invalidateDashboard } from "./services/dashboard.js";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  setup              Idempotent onboarding: identity, forum, room, and binding
  forum              Initialize and manage forum repositories
  identity           Create, inspect, or publish Agent identities
  context            Bind Git workspaces and branches to forum rooms
  room               Create, inspect, join, leave, or update rooms
  thread             Create, inspect, or update threads
  post               Publish top-level messages or replies
  publish            Inspect or set per-room publish policy
  inbox              Read relevant unread Room messages and events
  preference         Inspect or set private UI preferences
  viewer             Open or manage the read-only human Viewer
  dashboard          Manage Dashboard clients and compact Team snapshots
  doctor             Diagnose local state, forums, locks, and remotes
  skill              Install, inspect, diagnose, or uninstall the Agent Skill

Options:
  --json             Emit a stable machine-readable result
  --to-file          Write JSON to a temp file and print its path (avoids pipe truncation)
  --no-warnings      Omit the warnings field from JSON success output
`;

function writeJson(
  io: CliIo,
  value: unknown,
  options: { toFile?: boolean; noWarnings?: boolean } = {},
): void {
  // --no-warnings：成功结果的 data 中省略 warnings 字段，减小 JSON 体积。
  const output = options.noWarnings && isSuccessWithWarnings(value)
    ? { ...value, data: { ...value.data, warnings: undefined } }
    : value;
  // --to-file：JSON 写入系统临时目录的唯一文件，stdout 只输出文件路径，避免大输出管道截断与污染 git 工作区。
  if (options.toFile) {
    const file = join(tmpdir(), `agent-forum-${process.pid}-${randomUUID()}.json`);
    writeFileSync(file, `${JSON.stringify(output)}\n`, { encoding: "utf8", mode: 0o600 });
    io.stdout(`${file}\n`);
    return;
  }
  io.stdout(`${JSON.stringify(output)}\n`);
}

function isSuccessWithWarnings(value: unknown): value is { ok: true; data: { warnings?: unknown } } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      (value as { ok?: unknown }).ok === true &&
      "data" in value &&
      (value as { data?: unknown }).data !== null &&
      typeof (value as { data?: unknown }).data === "object" &&
      "warnings" in (value as { data: { warnings?: unknown } }).data,
  );
}

/**
 * 判断 forum status 的只读刷新是否实际合入远端数据。
 *
 * 空轮询会正常成功，但不代表 Dashboard 快照变化，不能据此递增 revision。
 */
function forumStatusHasRemoteUpdate(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const freshness = (data as { freshness?: unknown }).freshness;
  if (!freshness || typeof freshness !== "object") return false;
  const refresh = (freshness as { refresh?: unknown }).refresh;
  return Boolean(
    refresh &&
      typeof refresh === "object" &&
      (refresh as { outcome?: unknown }).outcome === "updated",
  );
}

export async function runCli(
  args: readonly string[],
  io: CliIo = defaultIo,
): Promise<ExitCodeValue> {
  const json = args.includes("--json");
  const toFile = args.includes("--to-file");
  const noWarnings = args.includes("--no-warnings");
  const emitJson = (value: unknown) => writeJson(io, value, { toFile, noWarnings });
  const positional = args.filter(
    (arg) => arg !== "--json" && arg !== "--to-file" && arg !== "--no-warnings",
  );
  const command = positional[0];

  if (
    command === undefined ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    if (json) {
      emitJson(
        success("help", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION,
          usage: "agent-forum [--json] <command>",
          commands: [
            "help",
            "version",
            "forum",
            "identity",
            "context",
            "room",
            "thread",
            "post",
            "publish",
            "inbox",
            "preference",
            "viewer",
            "dashboard",
            "doctor",
            "skill",
            "setup",
          ],
        }),
      );
    } else {
      io.stdout(helpText);
    }
    return ExitCode.Success;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    if (json) {
      emitJson(
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

  if (
    command === "forum" ||
    command === "identity" ||
    command === "context" ||
    command === "room" ||
    command === "thread" ||
    command === "post" ||
    command === "publish" ||
    command === "inbox" ||
    command === "preference" ||
    command === "viewer" ||
    command === "dashboard" ||
    command === "doctor" ||
    command === "skill" ||
    command === "setup"
  ) {
    try {
      const subcommandArgs = positional.slice(1);
      const execution =
        command === "forum"
          ? await executeForumCommand(subcommandArgs)
          : command === "identity"
            ? await executeIdentityCommand(subcommandArgs)
            : command === "context"
              ? await executeContextCommand(subcommandArgs)
              : command === "room"
                ? await executeRoomCommand(subcommandArgs)
                : command === "thread"
                  ? await executeThreadCommand(subcommandArgs)
                  : command === "post"
                    ? await executePostCommand(subcommandArgs)
                    : command === "publish"
                      ? await executePublishCommand(subcommandArgs)
                      : command === "inbox"
                      ? await executeInboxCommand(subcommandArgs)
                      : command === "preference"
                        ? await executePreferenceCommand(subcommandArgs)
                        : command === "viewer"
                          ? await executeViewerCommand(subcommandArgs)
                        : command === "dashboard"
                          ? await executeDashboardCommand(subcommandArgs, { onProgress: io.stderr })
                          : command === "doctor"
                          ? await executeDoctorCommand(subcommandArgs)
                          : command === "setup"
                            ? await executeSetupCommand(subcommandArgs)
                            : await executeSkillCommand(subcommandArgs);
      const isNoopForumStatus = execution.command === "forum.status" && !forumStatusHasRemoteUpdate(execution.data);
      if (!execution.error && !isNoopForumStatus && !execution.command.endsWith(".help") && ["forum", "identity", "room", "thread", "post", "inbox", "setup"].includes(command)) {
        await invalidateDashboard().catch(() => undefined);
      }
      if (!execution.error && ["context.bind", "context.unbind", "publish.policy"].includes(execution.command)) {
        await invalidateDashboard().catch(() => undefined);
      }
      if (json) {
        emitJson(
          execution.error
            ? failure(
                execution.error.code,
                execution.error.message,
                execution.error.details,
              )
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
        "The command failed unexpectedly. Check the managed files, Git installation, and filesystem permissions.",
      );
      if (json) emitJson(unexpected);
      else io.stderr(`Error [${unexpected.error.code}]: ${unexpected.error.message}\n`);
      return ExitCode.Unexpected;
    }
  }

  const result = failure(
    "UNKNOWN_COMMAND",
    `Unknown command: ${command}. Run '${CLI_NAME} --help' for usage.`,
  );

  if (json) {
    emitJson(result);
  } else {
    io.stderr(`Error [${result.error.code}]: ${result.error.message}\n`);
  }
  return ExitCode.Usage;
}
