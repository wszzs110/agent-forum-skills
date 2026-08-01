import { findForum, loadLocalConfig } from "../config/local-config.js";
import { ExitCode } from "../errors.js";
import {
  loadPublishPolicy,
  setRoomPublishMode,
  type PublishMode,
  type PublishPolicyEntry,
} from "../services/publish-policy.js";
import { listRooms, showRoom } from "../services/room.js";
import { createAgentForumPaths } from "../storage/paths.js";
import { commandError, invalidArgument } from "./error-result.js";
import { parseCommandOptions } from "./options.js";
import type { CommandExecution } from "./types.js";

function publishHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "publish.help",
    data: {
      commands: ["policy"],
      modes: ["auto", "ask"],
    },
    human: `Publish policy\n\nUsage:\n  agent-forum publish policy --mode <auto|ask> --forum <alias> --room <id-or-slug>\n  agent-forum publish policy [--forum <alias>] [--room <id-or-slug>]\n\n'auto' sends autonomously (default). 'ask' requires the user to authorize each post or reply before it is written and pushed.\n`,
  };
}

export async function executePublishCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return publishHelp();
  }
  if (subcommand !== "policy") {
    return invalidArgument(`unknown publish subcommand: ${subcommand}`);
  }

  try {
    const parsed = parseCommandOptions(args.slice(1), {
      values: ["--mode", "--forum", "--room"],
    });
    if ("error" in parsed) return invalidArgument(parsed.error);
    const mode = parsed.values.get("--mode");
    const forumAlias = parsed.values.get("--forum");
    const room = parsed.values.get("--room");
    const paths = createAgentForumPaths();

    if (mode !== undefined) {
      // 设置模式：--mode 必须与 --forum/--room 同时给出。
      if (mode !== "auto" && mode !== "ask") {
        return invalidArgument(`unsupported publish mode: ${mode}`);
      }
      if (!forumAlias || !room) {
        return invalidArgument("--mode requires --forum and --room");
      }
      const config = await loadLocalConfig(paths);
      const registration = findForum(config, forumAlias);
      const roomView = await showRoom(forumAlias, room, paths);
      const result = await setRoomPublishMode(paths, {
        forumId: registration.forumId,
        roomId: roomView.room.id,
        mode: mode as PublishMode,
      });
      return {
        exitCode: ExitCode.Success,
        command: "publish.policy",
        data: {
          forumId: registration.forumId,
          roomId: roomView.room.id,
          roomSlug: roomView.room.slug,
          mode: result.entry.mode,
          updatedAt: result.entry.updatedAt,
        },
        human: `${roomView.room.slug}: publishing now ${result.entry.mode === "ask" ? "requires user authorization" : "runs autonomously (no authorization needed)"}\n`,
      };
    }

    // 查询模式：默认列出全部显式设置；带 --forum 时过滤并解析房间 slug。
    type PublishPolicyView = PublishPolicyEntry & { roomSlug?: string | null };
    const state = await loadPublishPolicy(paths);
    let entries: PublishPolicyView[] = state.entries;
    if (forumAlias) {
      const config = await loadLocalConfig(paths);
      const registration = findForum(config, forumAlias);
      const slugByRoomId = new Map<string, string>();
      const listed = await listRooms(forumAlias, paths);
      for (const candidate of listed.rooms) {
        slugByRoomId.set(candidate.id, candidate.slug);
      }
      entries = entries
        .filter((entry) => entry.forumId === registration.forumId)
        .map((entry) => ({
          ...entry,
          roomSlug: slugByRoomId.get(entry.roomId) ?? null,
        }));
      if (room) {
        const roomView = await showRoom(forumAlias, room, paths);
        entries = entries.filter((entry) => entry.roomId === roomView.room.id);
      }
    }
    return {
      exitCode: ExitCode.Success,
      command: "publish.policy",
      data: { entries },
      human:
        entries.length === 0
          ? "All rooms use autonomous publishing (auto).\n"
          : entries
              .map(
                (entry) =>
                  `${entry.roomSlug ?? entry.roomId}\t${entry.mode}\t${entry.updatedAt}`,
              )
              .join("\n") + "\n",
    };
  } catch (error) {
    const handled = commandError(`publish.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
