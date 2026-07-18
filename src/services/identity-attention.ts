import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createLocalIdentity,
  findForum,
  findIdentity,
  loadLocalConfig,
  type LocalIdentity,
} from "../config/local-config.js";
import { isCanonicalUtcTimestamp, currentUtcTimestamp } from "../domain/timestamps.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, forumStatePath, type AgentForumPaths } from "../storage/paths.js";
import { readJsonDocument } from "./room.js";
import { ServiceError } from "./errors.js";

export type AttentionMode = "recovery" | "delegation";

export interface IdentityAttentionLink {
  subjectMemberId: string;
  mode: AttentionMode;
  reason: string;
  createdAt: string;
  expiresAt?: string;
}

interface IdentityAttentionState {
  schemaVersion: "1.0";
  forumId: string;
  ownerMemberId: string;
  links: IdentityAttentionLink[];
  updatedAt: string;
}

function attentionPath(paths: AgentForumPaths, forumId: string, ownerMemberId: string): string {
  return resolve(forumStatePath(paths, forumId), "attention", `${ownerMemberId}.json`);
}

function isActiveLink(link: IdentityAttentionLink, now: Date): boolean {
  return link.expiresAt === undefined || new Date(link.expiresAt).valueOf() > now.valueOf();
}

async function loadState(
  forumId: string,
  ownerMemberId: string,
  paths: AgentForumPaths,
): Promise<IdentityAttentionState> {
  const path = attentionPath(paths, forumId, ownerMemberId);
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    const validation = validateProtocolDocument("identity-attention", value);
    if (!validation.ok || value.forumId !== forumId || value.ownerMemberId !== ownerMemberId) {
      throw new StorageError("SCHEMA_VALIDATION_FAILED", `identity attention state is invalid: ${path}`);
    }
    const state = value as IdentityAttentionState;
    if (new Set(state.links.map((link) => link.subjectMemberId)).size !== state.links.length) {
      throw new StorageError("SCHEMA_VALIDATION_FAILED", `identity attention state has duplicate subjects: ${path}`);
    }
    return state;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        schemaVersion: "1.0",
        forumId,
        ownerMemberId,
        links: [],
        updatedAt: currentUtcTimestamp(),
      };
    }
    throw error;
  }
}

async function resolveOwner(
  forumAlias: string,
  ownerMemberId: string | undefined,
  paths: AgentForumPaths,
): Promise<{ forumId: string; owner: LocalIdentity; forumPath: string }> {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, forumAlias);
  return {
    forumId: forum.forumId,
    forumPath: forum.path,
    owner: findIdentity(config, ownerMemberId),
  };
}

export async function recoverIdentity(
  input: { forumAlias: string; memberId: string; setDefault?: boolean },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ action: "recovered" | "unchanged"; identity: LocalIdentity; forumAlias: string; profileStatus: string }> {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, input.forumAlias);
  const profile = await readJsonDocument(
    resolve(forum.path, "members", input.memberId, "profile.json"),
    "member-profile",
  );
  if (profile.memberId !== input.memberId) {
    throw new ServiceError("IDENTITY_RECOVERY_FAILED", "remote profile memberId does not match requested memberId");
  }
  const existing = config.identities.find((identity) => identity.memberId === input.memberId);
  if (existing) {
    if (input.setDefault && config.defaultIdentityId !== existing.memberId) {
      // 复用 update 的锁与原子写语义，仅改变默认身份选择。
      const { updateLocalIdentity } = await import("../config/local-config.js");
      const result = await updateLocalIdentity({ memberId: existing.memberId, setDefault: true }, paths);
      return { action: "unchanged", identity: result.identity, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
    }
    return { action: "unchanged", identity: existing, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
  }
  const result = await createLocalIdentity({
    memberId: input.memberId,
    displayName: String(profile.displayName),
    role: String(profile.role),
    responsibility: String(profile.responsibility),
    ...(typeof profile.client === "string" ? { client: profile.client } : {}),
    setDefault: input.setDefault ?? true,
  }, paths);
  return { action: "recovered", identity: result.identity, forumAlias: input.forumAlias, profileStatus: String(profile.status) };
}

export async function listIdentityAttention(
  input: { forumAlias: string; ownerMemberId?: string; includeExpired?: boolean },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ ownerMemberId: string; links: Array<IdentityAttentionLink & { active: boolean }> }> {
  const { forumId, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  const state = await loadState(forumId, owner.memberId, paths);
  const now = new Date();
  const links = state.links
    .map((link) => ({ ...link, active: isActiveLink(link, now) }))
    .filter((link) => input.includeExpired || link.active);
  return { ownerMemberId: owner.memberId, links };
}

export async function addIdentityAttention(
  input: {
    forumAlias: string;
    ownerMemberId?: string;
    subjectMemberId: string;
    mode: AttentionMode;
    reason: string;
    expiresAt?: string;
  },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ action: "added" | "updated"; ownerMemberId: string; link: IdentityAttentionLink }> {
  if (input.mode === "delegation" && !input.expiresAt) {
    throw new ServiceError("ATTENTION_EXPIRY_REQUIRED", "delegation attention requires --until UTC timestamp");
  }
  if (input.expiresAt && !isCanonicalUtcTimestamp(input.expiresAt)) {
    throw new ServiceError("ATTENTION_EXPIRY_INVALID", "attention expiry must use canonical UTC milliseconds timestamp");
  }
  if (input.expiresAt && new Date(input.expiresAt).valueOf() <= Date.now()) {
    throw new ServiceError("ATTENTION_EXPIRY_INVALID", "attention expiry must be in the future");
  }
  const { forumId, forumPath, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  if (owner.memberId === input.subjectMemberId) {
    throw new ServiceError("ATTENTION_SELF_REFERENCE", "identity attention subject must differ from owner");
  }
  const profile = await readJsonDocument(
    resolve(forumPath, "members", input.subjectMemberId, "profile.json"),
    "member-profile",
  );
  if (profile.memberId !== input.subjectMemberId) {
    throw new ServiceError("ATTENTION_SUBJECT_NOT_FOUND", "attention subject profile does not match requested memberId");
  }
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, `attention-${forumId}-${owner.memberId}.lock`),
    command: "identity attention add",
  });
  try {
    const state = await loadState(forumId, owner.memberId, paths);
    const timestamp = currentUtcTimestamp();
    const link: IdentityAttentionLink = {
      subjectMemberId: input.subjectMemberId,
      mode: input.mode,
      reason: input.reason,
      createdAt: state.links.find((item) => item.subjectMemberId === input.subjectMemberId)?.createdAt ?? timestamp,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    };
    const existing = state.links.find((item) => item.subjectMemberId === input.subjectMemberId);
    const links = existing
      ? state.links.map((item) => item.subjectMemberId === input.subjectMemberId ? link : item)
      : [...state.links, link];
    await writeValidatedJsonAtomic(attentionPath(paths, forumId, owner.memberId), "identity-attention", {
      ...state,
      links,
      updatedAt: timestamp,
    }, { overwrite: true, mode: 0o600 });
    return { action: existing ? "updated" : "added", ownerMemberId: owner.memberId, link };
  } finally {
    await lock.release();
  }
}

export async function removeIdentityAttention(
  input: { forumAlias: string; ownerMemberId?: string; subjectMemberId: string },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ removed: boolean; ownerMemberId: string }> {
  const { forumId, owner } = await resolveOwner(input.forumAlias, input.ownerMemberId, paths);
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, `attention-${forumId}-${owner.memberId}.lock`),
    command: "identity attention remove",
  });
  try {
    const state = await loadState(forumId, owner.memberId, paths);
    const links = state.links.filter((link) => link.subjectMemberId !== input.subjectMemberId);
    const removed = links.length !== state.links.length;
    if (removed) {
      await writeValidatedJsonAtomic(attentionPath(paths, forumId, owner.memberId), "identity-attention", {
        ...state,
        links,
        updatedAt: currentUtcTimestamp(),
      }, { overwrite: true, mode: 0o600 });
    }
    return { removed, ownerMemberId: owner.memberId };
  } finally {
    await lock.release();
  }
}
