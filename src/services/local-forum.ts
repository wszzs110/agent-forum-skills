import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  findForum,
  findIdentity,
  loadLocalConfig,
  saveLocalConfig,
  type LocalIdentity,
} from "../config/local-config.js";
import { createEntityId } from "../domain/ids.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import {
  assertCleanWorktree,
  assertGitBranchName,
  commitPaths,
  configureForumCommitIdentity,
  requireGit,
  runGit,
} from "../git/runner.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeFileAtomic, writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  assertLocalAlias,
  createAgentForumPaths,
  forumClonePath,
  forumLockPath,
  sameExistingPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { ServiceError } from "./errors.js";

export interface InitLocalForumInput {
  alias: string;
  name: string;
  description: string;
  dataBranch?: string;
  identityId?: string;
  now?: Date;
  forumId?: string;
}

export interface InitLocalForumResult {
  alias: string;
  forumId: string;
  path: string;
  dataBranch: string;
  identityId: string;
  commit: string;
}

export interface PublishIdentityResult {
  alias: string;
  forumId: string;
  identityId: string;
  path: string;
  action: "published" | "unchanged";
  commit?: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function publicProfile(identity: LocalIdentity, updatedAt: string) {
  return {
    schemaVersion: "1.0",
    memberId: identity.memberId,
    displayName: identity.displayName,
    role: identity.role,
    responsibility: identity.responsibility,
    status: "active",
    ...(identity.client ? { client: identity.client } : {}),
    createdAt: identity.createdAt,
    updatedAt,
  };
}

function samePublishedIdentity(
  existing: Record<string, unknown>,
  identity: LocalIdentity,
): boolean {
  return (
    existing.memberId === identity.memberId &&
    existing.displayName === identity.displayName &&
    existing.role === identity.role &&
    existing.responsibility === identity.responsibility &&
    existing.status === "active" &&
    existing.client === identity.client
  );
}

export async function initLocalForum(
  input: InitLocalForumInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<InitLocalForumResult> {
  assertLocalAlias(input.alias);
  const dataBranch = input.dataBranch ?? "main";
  await mkdir(paths.forumsDirectory, { recursive: true });
  assertGitBranchName(paths.forumsDirectory, dataBranch);

  const configLock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, "config.lock"),
    command: "forum init-local",
  });
  const destination = forumClonePath(paths, input.alias);
  const staging = resolve(
    paths.forumsDirectory,
    `.agent-forum-tmp-${randomUUID()}`,
  );
  let destinationCreated = false;

  try {
    const config = await loadLocalConfig(paths);
    if (config.forums.some((forum) => forum.alias === input.alias)) {
      throw new ServiceError(
        "FORUM_ALIAS_EXISTS",
        `forum alias is already configured: ${input.alias}`,
      );
    }
    if (await pathExists(destination)) {
      throw new ServiceError(
        "FORUM_PATH_EXISTS",
        `forum path already exists: ${destination}`,
      );
    }
    const identity = findIdentity(config, input.identityId);
    const forumId = input.forumId ?? createEntityId("forum");
    const timestamp = currentUtcTimestamp(input.now);

    requireGit(paths.forumsDirectory, [
      "-c",
      "core.longpaths=true",
      "init",
      "--initial-branch",
      dataBranch,
      staging,
    ]);
    configureForumCommitIdentity(
      staging,
      identity.displayName,
      identity.memberId,
    );
    await writeFileAtomic(
      resolve(staging, ".gitattributes"),
      "*.json text eol=lf\n*.md text eol=lf\n",
    );
    await writeValidatedJsonAtomic(
      resolve(staging, ".forum", "protocol.json"),
      "protocol",
      {
        protocolVersion: "1.0",
        stability: "draft",
        forumId,
        dataBranch,
        createdAt: timestamp,
      },
    );
    await writeValidatedJsonAtomic(
      resolve(staging, ".forum", "forum.json"),
      "forum",
      {
        schemaVersion: "1.0",
        forumId,
        initialName: input.name,
        initialDescription: input.description,
        createdBy: identity.memberId,
        createdAt: timestamp,
      },
    );
    await writeValidatedJsonAtomic(
      resolve(staging, "members", identity.memberId, "profile.json"),
      "member-profile",
      publicProfile(identity, timestamp),
    );
    const commit = commitPaths(
      staging,
      [".gitattributes", ".forum", "members"],
      `Initialize forum ${input.alias}`,
    );

    await rename(staging, destination);
    destinationCreated = true;
    await saveLocalConfig(paths, {
      ...config,
      forums: [
        ...config.forums,
        {
          alias: input.alias,
          forumId,
          path: destination,
          dataBranch,
          createdAt: timestamp,
        },
      ],
    });

    return {
      alias: input.alias,
      forumId,
      path: destination,
      dataBranch,
      identityId: identity.memberId,
      commit,
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (destinationCreated) {
      await rm(destination, { recursive: true, force: true });
    }
    throw error;
  } finally {
    await configLock.release();
  }
}

export async function publishIdentity(
  alias: string,
  identityId: string | undefined,
  paths: AgentForumPaths = createAgentForumPaths(),
  now = new Date(),
): Promise<PublishIdentityResult> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, alias);
  const identity = findIdentity(config, identityId);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "identity publish",
  });
  const profilePath = resolve(
    registration.path,
    "members",
    identity.memberId,
    "profile.json",
  );

  try {
    const topLevel = requireGit(registration.path, [
      "rev-parse",
      "--show-toplevel",
    ]).stdout.trim();
    if (!(await sameExistingPath(topLevel, registration.path))) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `configured forum path is not the Git root: ${registration.path}`,
      );
    }
    assertCleanWorktree(registration.path);
    const currentBranch = requireGit(registration.path, [
      "branch",
      "--show-current",
    ]).stdout.trim();
    if (currentBranch !== registration.dataBranch) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `managed forum is on '${currentBranch}', expected '${registration.dataBranch}'`,
      );
    }
    const protocol = JSON.parse(
      await readFile(
        resolve(registration.path, ".forum", "protocol.json"),
        "utf8",
      ),
    );
    const protocolValidation = validateProtocolDocument("protocol", protocol, {
      mode: "read",
    });
    if (
      !protocolValidation.ok ||
      protocol.forumId !== registration.forumId ||
      protocol.dataBranch !== registration.dataBranch
    ) {
      throw new ServiceError(
        "FORUM_PROTOCOL_MISMATCH",
        `forum protocol does not match local registration: ${alias}`,
        protocolValidation.ok ? undefined : protocolValidation.issues,
      );
    }

    let previous: string | undefined;
    let existing: Record<string, unknown> | undefined;
    try {
      previous = await readFile(profilePath, "utf8");
      existing = JSON.parse(previous) as Record<string, unknown>;
      const validation = validateProtocolDocument("member-profile", existing, {
        mode: "read",
      });
      if (!validation.ok) {
        throw new StorageError(
          "SCHEMA_VALIDATION_FAILED",
          `existing public member profile is invalid: ${profilePath}`,
          validation.issues,
        );
      }
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }

    if (existing && samePublishedIdentity(existing, identity)) {
      return {
        alias,
        forumId: registration.forumId,
        identityId: identity.memberId,
        path: profilePath,
        action: "unchanged",
      };
    }

    const createdAt =
      existing && typeof existing.createdAt === "string"
        ? existing.createdAt
        : identity.createdAt;
    const profile = {
      ...publicProfile(identity, currentUtcTimestamp(now)),
      createdAt,
    };
    try {
      await writeValidatedJsonAtomic(
        profilePath,
        "member-profile",
        profile,
        { overwrite: true },
      );
      configureForumCommitIdentity(
        registration.path,
        identity.displayName,
        identity.memberId,
      );
      const status = requireGit(registration.path, [
        "status",
        "--porcelain",
        "--",
        profilePath,
      ]).stdout;
      if (status.trim().length === 0) {
        return {
          alias,
          forumId: registration.forumId,
          identityId: identity.memberId,
          path: profilePath,
          action: "unchanged",
        };
      }
      const commit = commitPaths(
        registration.path,
        [profilePath],
        `Publish identity ${identity.memberId}`,
      );
      return {
        alias,
        forumId: registration.forumId,
        identityId: identity.memberId,
        path: profilePath,
        action: "published",
        commit,
      };
    } catch (error) {
      runGit(registration.path, ["reset", "--", profilePath]);
      if (previous === undefined) {
        await rm(profilePath, { force: true });
      } else {
        await writeFileAtomic(profilePath, previous, { overwrite: true });
      }
      throw error;
    }
  } finally {
    await lock.release();
  }
}
