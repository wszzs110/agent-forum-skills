import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createEntityId } from "../domain/ids.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumClonePath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { ServiceError } from "../services/errors.js";

export interface LocalIdentity {
  memberId: string;
  displayName: string;
  role: string;
  responsibility: string;
  client?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalForumRegistration {
  alias: string;
  forumId: string;
  path: string;
  dataBranch: string;
  createdAt: string;
}

export interface LocalConfig {
  formatVersion: 1;
  defaultIdentityId: string | null;
  identities: LocalIdentity[];
  forums: LocalForumRegistration[];
}

export interface CreateIdentityInput {
  displayName: string;
  role: string;
  responsibility: string;
  client?: string;
  setDefault?: boolean;
  now?: Date;
  memberId?: string;
}

export function emptyLocalConfig(): LocalConfig {
  return {
    formatVersion: 1,
    defaultIdentityId: null,
    identities: [],
    forums: [],
  };
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `local config contains duplicate ${label}`,
    );
  }
}

function validateLocalConfigSemantics(
  config: LocalConfig,
  paths: AgentForumPaths,
): void {
  assertUnique(config.identities.map((identity) => identity.memberId), "member IDs");
  assertUnique(config.forums.map((forum) => forum.alias), "forum aliases");
  assertUnique(config.forums.map((forum) => forum.forumId), "forum IDs");
  assertUnique(config.forums.map((forum) => resolve(forum.path)), "forum paths");
  if (
    config.defaultIdentityId !== null &&
    !config.identities.some(
      (identity) => identity.memberId === config.defaultIdentityId,
    )
  ) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      "defaultIdentityId does not refer to a configured identity",
    );
  }
  for (const forum of config.forums) {
    if (resolve(forum.path) !== forumClonePath(paths, forum.alias)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `forum path is outside the managed alias location: ${forum.alias}`,
      );
    }
  }
}

export async function loadLocalConfig(
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<LocalConfig> {
  try {
    const value = JSON.parse(await readFile(paths.configFile, "utf8"));
    const validation = validateProtocolDocument("local-config", value, {
      mode: "write",
    });
    if (!validation.ok) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `local config is invalid: ${paths.configFile}`,
        validation.issues,
      );
    }
    const config = value as LocalConfig;
    validateLocalConfigSemantics(config, paths);
    return config;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyLocalConfig();
    }
    throw error;
  }
}

export async function saveLocalConfig(
  paths: AgentForumPaths,
  config: LocalConfig,
): Promise<void> {
  validateLocalConfigSemantics(config, paths);
  await writeValidatedJsonAtomic(paths.configFile, "local-config", config, {
    overwrite: true,
    mode: 0o600,
  });
}

export function findIdentity(
  config: LocalConfig,
  memberId?: string,
): LocalIdentity {
  const selected = memberId ?? config.defaultIdentityId;
  if (!selected) {
    throw new ServiceError(
      "DEFAULT_IDENTITY_REQUIRED",
      "no default identity is configured",
    );
  }
  const identity = config.identities.find(
    (candidate) => candidate.memberId === selected,
  );
  if (!identity) {
    throw new ServiceError(
      "IDENTITY_NOT_FOUND",
      `identity is not configured: ${selected}`,
    );
  }
  return identity;
}

export function findForum(
  config: LocalConfig,
  alias: string,
): LocalForumRegistration {
  const forum = config.forums.find((candidate) => candidate.alias === alias);
  if (!forum) {
    throw new ServiceError("FORUM_NOT_FOUND", `forum alias is not configured: ${alias}`);
  }
  return forum;
}

async function acquireConfigLock(paths: AgentForumPaths, command: string) {
  return acquireForumLock({
    lockPath: resolve(paths.locksDirectory, "config.lock"),
    command,
  });
}

export async function createLocalIdentity(
  input: CreateIdentityInput,
  paths = createAgentForumPaths(),
): Promise<{ identity: LocalIdentity; defaultIdentityId: string }> {
  const lock = await acquireConfigLock(paths, "identity create");
  try {
    const config = await loadLocalConfig(paths);
    const timestamp = currentUtcTimestamp(input.now);
    const memberId = input.memberId ?? createEntityId("member");
    if (config.identities.some((identity) => identity.memberId === memberId)) {
      throw new ServiceError(
        "IDENTITY_EXISTS",
        `identity is already configured: ${memberId}`,
      );
    }
    const identity: LocalIdentity = {
      memberId,
      displayName: input.displayName,
      role: input.role,
      responsibility: input.responsibility,
      ...(input.client ? { client: input.client } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const defaultIdentityId =
      input.setDefault === false && config.defaultIdentityId
        ? config.defaultIdentityId
        : identity.memberId;
    const next: LocalConfig = {
      ...config,
      defaultIdentityId,
      identities: [...config.identities, identity],
    };
    await saveLocalConfig(paths, next);
    return { identity, defaultIdentityId };
  } finally {
    await lock.release();
  }
}

export async function registerLocalForum(
  registration: LocalForumRegistration,
  paths = createAgentForumPaths(),
): Promise<void> {
  const lock = await acquireConfigLock(paths, "forum register");
  try {
    const config = await loadLocalConfig(paths);
    if (config.forums.some((forum) => forum.alias === registration.alias)) {
      throw new ServiceError(
        "FORUM_ALIAS_EXISTS",
        `forum alias is already configured: ${registration.alias}`,
      );
    }
    await saveLocalConfig(paths, {
      ...config,
      forums: [...config.forums, registration],
    });
  } finally {
    await lock.release();
  }
}
