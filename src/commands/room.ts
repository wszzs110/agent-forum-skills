import { ExitCode } from "../errors.js";
import {
  createRoom,
  createRoomEvent,
  joinRoom,
  leaveRoom,
  listRooms,
  showRoom,
} from "../services/room.js";
import { listRemoteForums } from "../services/forum-remote.js";
import { refreshAllForRead, refreshForRead } from "../services/read-freshness.js";
import { commandError, invalidArgument } from "./error-result.js";
import {
  parseCommandOptions,
  requireOption,
  type ParsedCommandOptions,
} from "./options.js";
import type { CommandExecution } from "./types.js";

function roomHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "room.help",
    data: {
      commands: [
        "create",
        "list",
        "show",
        "join",
        "leave",
        "rename",
        "set-description",
        "archive",
        "restore",
        "deprecate",
        "reenable",
      ],
    },
    human: `Room management\n\nUsage:\n  agent-forum room create --forum <alias> --slug <slug> --title <title> --description <text> [--allow-similar]\n  agent-forum room list --forum <alias> [--no-sync]\n  agent-forum room list --all [--no-sync]\n  agent-forum room show --forum <alias> --room <id-or-slug> [--no-sync]\n  agent-forum room join --forum <alias> --room <id-or-slug> [--role <role>] [--responsibility <text>]\n  agent-forum room leave --forum <alias> --room <id-or-slug>\n  agent-forum room rename --forum <alias> --room <id-or-slug> --title <title> --reason <reason>\n  agent-forum room set-description --forum <alias> --room <id-or-slug> --description <text> --reason <reason>\n  agent-forum room archive|restore --forum <alias> --room <id-or-slug> --reason <reason>\n  agent-forum room deprecate --forum <alias> --room <id-or-slug> --reason <reason> [--replacement <id-or-slug>]\n  agent-forum room reenable --forum <alias> --room <id-or-slug> --reason <reason>\n`,
  };
}

function valueOrError(
  parsed: ParsedCommandOptions,
  name: string,
): string | CommandExecution {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}

function commonRoomOptions(
  args: readonly string[],
  extraValues: readonly string[] = [],
): ParsedCommandOptions | CommandExecution {
  const parsed = parseCommandOptions(args, {
    values: ["--forum", "--room", "--identity", ...extraValues],
  });
  return "error" in parsed ? invalidArgument(parsed.error) : parsed;
}

export async function executeRoomCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return roomHelp();
  }

  try {
    if (subcommand === "create") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: [
          "--forum",
          "--slug",
          "--title",
          "--description",
          "--identity",
        ],
        flags: ["--allow-similar"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const slug = valueOrError(parsed, "--slug");
      if (typeof slug !== "string") return slug;
      const title = valueOrError(parsed, "--title");
      if (typeof title !== "string") return title;
      const description = valueOrError(parsed, "--description");
      if (typeof description !== "string") return description;
      const identityId = parsed.values.get("--identity");
      const result = await createRoom({
        forumAlias,
        slug,
        title,
        description,
        allowSimilar: parsed.flags.has("--allow-similar"),
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.create",
        data: result,
        human: `created: ${result.room.slug}\nroom: ${result.room.id}\ncommit: ${result.commit}\n`,
      };
    }

    if (subcommand === "list") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum"],
        flags: ["--all", "--no-sync"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const all = parsed.flags.has("--all");
      const requestedForum = parsed.values.get("--forum");
      if (all === Boolean(requestedForum)) {
        return invalidArgument("room list requires exactly one of --forum or --all");
      }
      const noSync = parsed.flags.has("--no-sync");
      if (requestedForum) {
        const freshness = await refreshForRead(requestedForum, { noSync });
        const result = await listRooms(requestedForum);
        return {
          exitCode: ExitCode.Success,
          command: "room.list",
          data: { ...result, freshness },
          human:
            result.rooms.length === 0
              ? "No Rooms.\n"
              : `${result.rooms.map((item) => `${item.slug}\t${item.status}${item.deprecation ? " (deprecated)" : ""}\t${item.creator?.displayName ?? item.createdBy}\t${item.title}`).join("\n")}\n`,
        };
      }
      const freshness = await refreshAllForRead({ noSync });
      const forumStatuses = await listRemoteForums();
      const forums: Array<{ forumAlias: string; rooms: Awaited<ReturnType<typeof listRooms>>; error?: { code: string; message: string } }> = [];
      for (const forum of forumStatuses.forums) {
        try {
          forums.push({ forumAlias: forum.alias, rooms: await listRooms(forum.alias) });
        } catch (error) {
          forums.push({
            forumAlias: forum.alias,
            rooms: { rooms: [], warnings: [] },
            error: {
              code: error instanceof Error && "code" in error ? String(error.code) : "ROOM_LIST_FAILED",
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
      return {
        exitCode: ExitCode.Success,
        command: "room.list",
        data: { forums, freshness },
        human: forums.length === 0
          ? "No Forums.\n"
          : `${forums.map((forum) => forum.error
            ? `[${forum.forumAlias}] unavailable: ${forum.error.code}`
            : `[${forum.forumAlias}]\n${forum.rooms.rooms.length ? forum.rooms.rooms.map((item) => `  ${item.slug}\t${item.status}${item.deprecation ? " (deprecated)" : ""}\t${item.creator?.displayName ?? item.createdBy}\t${item.title}`).join("\n") : "  No Rooms."}`).join("\n")}\n`,
      };
    }

    if (subcommand === "show") {
      const parsed = parseCommandOptions(args.slice(1), {
        values: ["--forum", "--room"],
        flags: ["--no-sync"],
      });
      if ("error" in parsed) return invalidArgument(parsed.error);
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError(parsed, "--room");
      if (typeof room !== "string") return room;
      const freshness = await refreshForRead(forumAlias, { noSync: parsed.flags.has("--no-sync") });
      const result = await showRoom(forumAlias, room);
      return {
        exitCode: ExitCode.Success,
        command: "room.show",
        data: { ...result, freshness },
        human: `${result.room.title} (${result.room.slug})\nstatus: ${result.room.status}\ncreator: ${result.room.creator?.displayName ?? result.room.createdBy}\n${result.room.deprecation ? `deprecated by: ${result.room.deprecation.changedBy.displayName} at ${result.room.deprecation.changedAt}\nreason: ${result.room.deprecation.reason}\n${result.room.deprecation.replacementRoomId ? `replacement: ${result.room.deprecation.replacementRoomId}\n` : ""}` : ""}${result.room.description}\n`,
      };
    }

    if (subcommand === "join") {
      const parsed = commonRoomOptions(args.slice(1), [
        "--role",
        "--responsibility",
      ]);
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError(parsed, "--room");
      if (typeof room !== "string") return room;
      const identityId = parsed.values.get("--identity");
      const role = parsed.values.get("--role");
      const responsibility = parsed.values.get("--responsibility");
      const result = await joinRoom({
        forumAlias,
        room,
        ...(identityId ? { identityId } : {}),
        ...(role ? { role } : {}),
        ...(responsibility ? { responsibility } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.join",
        data: result,
        human: `${result.action}: ${result.member.roomId}\n`,
      };
    }

    if (subcommand === "leave") {
      const parsed = commonRoomOptions(args.slice(1));
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError(parsed, "--room");
      if (typeof room !== "string") return room;
      const identityId = parsed.values.get("--identity");
      const result = await leaveRoom({
        forumAlias,
        room,
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: "room.leave",
        data: result,
        human: `${result.action}: ${result.member.roomId}\n`,
      };
    }

    if (
      subcommand === "rename" ||
      subcommand === "set-description" ||
      subcommand === "archive" ||
      subcommand === "restore" ||
      subcommand === "deprecate" ||
      subcommand === "reenable"
    ) {
      const extra =
        subcommand === "rename"
          ? ["--title", "--reason"]
          : subcommand === "set-description"
            ? ["--description", "--reason"]
            : subcommand === "deprecate"
              ? ["--reason", "--replacement"]
              : ["--reason"];
      const parsed = commonRoomOptions(args.slice(1), extra);
      if ("exitCode" in parsed) return parsed;
      const forumAlias = valueOrError(parsed, "--forum");
      if (typeof forumAlias !== "string") return forumAlias;
      const room = valueOrError(parsed, "--room");
      if (typeof room !== "string") return room;
      const reason = valueOrError(parsed, "--reason");
      if (typeof reason !== "string") return reason;
      const identityId = parsed.values.get("--identity");
      const type =
        subcommand === "rename"
          ? "room-renamed"
          : subcommand === "set-description"
            ? "room-description-changed"
            : subcommand === "archive"
              ? "room-archived"
              : subcommand === "restore"
                ? "room-restored"
                : subcommand === "deprecate"
                  ? "room-deprecated"
                  : "room-reenabled";
      const replacement = parsed.values.get("--replacement");
      let replacementRoomId: string | undefined;
      if (replacement) {
        const replacementResult = await showRoom(forumAlias, replacement);
        if (replacementResult.room.id === room) {
          return invalidArgument("--replacement cannot be the deprecated room itself");
        }
        replacementRoomId = replacementResult.room.id;
      }
      const data =
        subcommand === "rename"
          ? { title: parsed.values.get("--title") }
          : subcommand === "set-description"
            ? { description: parsed.values.get("--description") }
            : replacementRoomId
              ? { replacementRoomId }
              : {};
      if (subcommand === "rename" && !data.title) {
        return invalidArgument("--title is required");
      }
      if (subcommand === "set-description" && !("description" in data && data.description)) {
        return invalidArgument("--description is required");
      }
      const result = await createRoomEvent({
        forumAlias,
        room,
        type,
        reason,
        data,
        ...(identityId ? { identityId } : {}),
      });
      return {
        exitCode: ExitCode.Success,
        command: `room.${subcommand}`,
        data: result,
        human: `${type}: ${result.room.slug}\ncommit: ${result.commit}\n`,
      };
    }

    return invalidArgument(`unknown room subcommand: ${subcommand}`);
  } catch (error) {
    const handled = commandError(`room.${subcommand}`, error);
    if (handled) return handled;
    throw error;
  }
}
