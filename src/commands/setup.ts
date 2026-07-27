import {
  createLocalIdentity,
  findIdentity,
  loadLocalConfig,
} from "../config/local-config.js";
import { ExitCode } from "../errors.js";
import { ContextError } from "../context/bindings.js";
import {
  addRemoteForum,
  inspectForumOriginRemote,
  publishLocalForum,
  remoteHasBranches,
} from "../services/forum-remote.js";
import { syncForum } from "../services/forum-sync.js";
import { createRoom, joinRoom } from "../services/room.js";
import { bindContext, resolveContext } from "../services/context.js";
import type { ResolvedContextView } from "../services/context.js";
import { initLocalForum, publishIdentity } from "../services/local-forum.js";
import { commandError, invalidArgument } from "./error-result.js";
import {
  parseCommandOptions,
  requireOption,
  type ParsedCommandOptions,
} from "./options.js";
import type { CommandExecution } from "./types.js";

function setupHelp(): CommandExecution {
  return {
    exitCode: ExitCode.Success,
    command: "setup.help",
    data: {
      commands: ["setup"],
    },
    human: `Interactive-first onboarding for a new Agent Forum workspace

Usage:
  agent-forum setup --alias <alias> --name <name> --description <text>
                    --room-slug <slug> --room-title <title> --room-description <text>
                    [--remote <url>] [--data-branch <branch>]
                    [--identity-name <name>] [--identity-role <role>] [--identity-responsibility <text>]
                    [--workspace | --bind-branch <branch>]

Steps performed idempotently:
  1. Create a default identity if none exists.
  2. Clone an existing Forum from --remote, or create a local Forum only when the remote is empty.
  3. Publish a newly created Forum to --remote if the alias has no remote configured.
  4. Create the Room if its slug does not exist.
  5. Publish the identity as an active Forum member.
  6. Join the Room with the published identity.
  7. Bind the current Git workspace/branch to the Room.

Use --data-branch to select the Forum collaboration data branch. Use --workspace to bind the default context for the whole workspace, or --bind-branch to bind one specific business-workspace branch.
`,
  };
}

function valueOrError(
  parsed: ParsedCommandOptions,
  name: string,
): string | CommandExecution {
  const value = requireOption(parsed, name);
  return typeof value === "string" ? value : invalidArgument(value.error);
}

export async function executeSetupCommand(
  args: readonly string[],
): Promise<CommandExecution> {
  const firstArgument = args[0];
  if (!firstArgument || firstArgument === "help" || firstArgument === "--help") {
    return setupHelp();
  }

  const parsed = parseCommandOptions(args, {
    values: [
      "--alias",
      "--name",
      "--description",
      "--room-slug",
      "--room-title",
      "--room-description",
      "--remote",
      "--data-branch",
      "--bind-branch",
      "--identity-name",
      "--identity-role",
      "--identity-responsibility",
      "--cwd",
    ],
    flags: ["--workspace"],
  });
  if ("error" in parsed) return invalidArgument(parsed.error);
  if (parsed.flags.has("--workspace") && parsed.values.has("--bind-branch")) {
    return invalidArgument("--workspace and --bind-branch cannot be combined");
  }

  const alias = valueOrError(parsed, "--alias");
  if (typeof alias !== "string") return alias;
  const name = valueOrError(parsed, "--name");
  if (typeof name !== "string") return name;
  const description = valueOrError(parsed, "--description");
  if (typeof description !== "string") return description;
  const roomSlug = valueOrError(parsed, "--room-slug");
  if (typeof roomSlug !== "string") return roomSlug;
  const roomTitle = valueOrError(parsed, "--room-title");
  if (typeof roomTitle !== "string") return roomTitle;
  const roomDescription = valueOrError(parsed, "--room-description");
  if (typeof roomDescription !== "string") return roomDescription;

  const remote = parsed.values.get("--remote");
  const dataBranch = parsed.values.get("--data-branch");
  const bindBranch = parsed.values.get("--bind-branch");
  const cwd = parsed.values.get("--cwd");
  const identityName = parsed.values.get("--identity-name") ?? "Collaborator";
  const identityRole = parsed.values.get("--identity-role") ?? "developer";
  const identityResponsibility =
    parsed.values.get("--identity-responsibility") ??
    "Works on features and coordinates with other agents.";
  const workspace = parsed.flags.has("--workspace");

  const log: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    // 1. Ensure default identity.
    const config = await loadLocalConfig();
    let identityId: string;
    if (!config.defaultIdentityId || config.identities.length === 0) {
      const created = await createLocalIdentity({
        displayName: identityName,
        role: identityRole,
        responsibility: identityResponsibility,
        setDefault: true,
      });
      identityId = created.identity.memberId;
      log.push(`created identity: ${identityId}`);
      data.identityCreated = {
        memberId: identityId,
        displayName: identityName,
        role: identityRole,
      };
    } else {
      const identity = findIdentity(config);
      identityId = identity.memberId;
      log.push(`using identity: ${identityId}`);
      data.identityUsed = { memberId: identityId };
    }

    // 2. Ensure local Forum. A non-empty remote is authoritative: clone it before any local init.
    const existingForum = config.forums.find((f) => f.alias === alias);
    let forumId: string;
    if (!existingForum) {
      if (remote && remoteHasBranches(remote)) {
        const added = await addRemoteForum({
          alias,
          remote,
          ...(dataBranch ? { branch: dataBranch } : {}),
        });
        forumId = added.forumId;
        log.push(`cloned existing forum: ${forumId}`);
        data.forumAdded = { forumId, path: added.path, branch: added.dataBranch };
      } else {
        const initResult = await initLocalForum({
          alias,
          name,
          description,
          dataBranch: dataBranch ?? "main",
          identityId,
        });
        forumId = initResult.forumId;
        log.push(`created forum: ${forumId}`);
        data.forumCreated = { forumId, path: initResult.path };
      }
    } else {
      forumId = existingForum.forumId;
      log.push(`using forum: ${forumId}`);
      data.forumUsed = { forumId, path: existingForum.path };
    }

    // 3. Publish to remote if requested and not already configured.
    if (remote) {
      const origin = await inspectForumOriginRemote({
        forumAlias: alias,
        expectedRemote: remote,
      });
      if (!origin.configured) {
        const publishResult = await publishLocalForum({ forumAlias: alias, remote });
        log.push(`published to remote: ${publishResult.remote}`);
        data.remotePublished = { remote: publishResult.remote, branch: publishResult.branch };
      } else if (origin.matchesExpected) {
        log.push(`remote already configured: ${origin.displayUrl}`);
        data.remoteUsed = { remote: origin.displayUrl };
      } else {
        // 复用正式 publish 的既有脱敏错误语义，拒绝无提示地换 remote。
        await publishLocalForum({ forumAlias: alias, remote });
      }
    }

    // 4. Ensure Room.
    const rooms = await import("../services/room.js").then((m) => m.listRooms(alias));
    const existingRoom = rooms.rooms.find((r) => r.slug === roomSlug);
    let roomId: string;
    if (!existingRoom) {
      const roomResult = await createRoom({
        forumAlias: alias,
        slug: roomSlug,
        title: roomTitle,
        description: roomDescription,
        identityId,
      });
      roomId = roomResult.room.id;
      log.push(`created room: ${roomId}`);
      data.roomCreated = { roomId, slug: roomSlug };
    } else {
      roomId = existingRoom.id;
      log.push(`using room: ${roomId}`);
      data.roomUsed = { roomId, slug: roomSlug };
    }

    // 5. Publish identity.
    const publishResult = await publishIdentity(alias, identityId);
    if (publishResult.action === "published") {
      log.push(`published identity in forum: ${publishResult.commit?.slice(0, 7) ?? "n/a"}`);
      data.identityPublished = { action: "published", commit: publishResult.commit };
    } else {
      log.push("identity already published in forum");
      data.identityPublished = { action: "unchanged" };
    }

    // 6. Join room.
    const joinResult = await joinRoom({ forumAlias: alias, room: roomId, identityId });
    log.push(`room membership: ${joinResult.action}`);
    data.roomMembership = { action: joinResult.action, memberId: joinResult.member.memberId };

    // 7. Bind context if not already bound to the same target.
    let resolved: ResolvedContextView | undefined;
    try {
      resolved = await resolveContext({ ...(cwd ? { cwd } : {}) });
    } catch (error) {
      if (
        !(error instanceof ContextError) ||
        (error.code !== "CONTEXT_NOT_BOUND" && error.code !== "BINDING_TARGET_UNAVAILABLE")
      ) {
        throw error;
      }
    }
    const alreadyBound =
      resolved &&
      resolved.targetStatus === "active" &&
      resolved.forumAlias === alias &&
      resolved.roomSlug === roomSlug;
    if (alreadyBound) {
      log.push(`context already bound: ${alias}/${roomSlug}`);
      data.contextBound = resolved;
    } else {
      const bindResult = await bindContext({
        forumAlias: alias,
        room: roomSlug,
        workspace,
        ...(cwd ? { cwd } : {}),
        ...(bindBranch ? { branch: bindBranch } : {}),
      });
      log.push(`bound context: ${bindResult.target.forumAlias}/${bindResult.target.roomSlug}`);
      data.contextBound = bindResult;
    }

    // 8. Publish setup-created member/Room commits as part of the promised one-command flow.
    if (remote) {
      const syncResult = await syncForum(alias);
      log.push(`synchronized remote: ${syncResult.outcome}`);
      data.remoteSynced = syncResult;
    }

    return {
      exitCode: ExitCode.Success,
      command: "setup",
      data,
      human: log.join("\n") + "\nsetup complete\n",
    };
  } catch (error) {
    const result = commandError("setup", error);
    if (result) return result;
    return {
      exitCode: ExitCode.Unexpected,
      command: "setup",
      error: {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      human: `Error [UNEXPECTED_ERROR]: ${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}
