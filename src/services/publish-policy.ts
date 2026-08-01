import { readFile } from "node:fs/promises";
import { findForum, loadLocalConfig } from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import type { AgentForumPaths } from "../storage/paths.js";
import { ServiceError } from "./errors.js";
import { showRoom } from "./room.js";

export type PublishMode = "auto" | "ask";

export interface PublishPolicyEntry {
  forumId: string;
  roomId: string;
  mode: PublishMode;
  updatedAt: string;
}

export interface PublishPolicyState {
  formatVersion: 1;
  entries: PublishPolicyEntry[];
}

function emptyPublishPolicy(): PublishPolicyState {
  return { formatVersion: 1, entries: [] };
}

function entryKey(entry: Pick<PublishPolicyEntry, "forumId" | "roomId">): string {
  return `${entry.forumId}\0${entry.roomId}`;
}

function validatePolicySemantics(state: PublishPolicyState): void {
  const keys = new Set<string>();
  for (const entry of state.entries) {
    const key = entryKey(entry);
    if (keys.has(key)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `publish policy contains duplicate room entry: ${key}`,
      );
    }
    keys.add(key);
  }
}

export async function loadPublishPolicy(
  paths: AgentForumPaths,
): Promise<PublishPolicyState> {
  let text;
  try {
    text = await readFile(paths.publishPolicyFile, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyPublishPolicy();
    }
    throw error;
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `publish policy contains invalid JSON: ${paths.publishPolicyFile}`,
      error instanceof Error ? error.message : String(error),
    );
  }
  const validation = validateProtocolDocument("publish-policy", value, {
    mode: "write",
  });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `publish policy is invalid: ${paths.publishPolicyFile}`,
      validation.issues,
    );
  }
  const state = value as PublishPolicyState;
  validatePolicySemantics(state);
  return state;
}

/** 读取房间投递模式；未显式设置的房间一律视为默认的 auto。 */
export async function getRoomPublishMode(
  paths: AgentForumPaths,
  forumId: string,
  roomId: string,
): Promise<PublishMode> {
  const state = await loadPublishPolicy(paths);
  const entry = state.entries.find(
    (candidate) =>
      candidate.forumId === forumId && candidate.roomId === roomId,
  );
  return entry?.mode ?? "auto";
}

/** 设置（或覆盖）某个房间的投递模式，覆盖与新增均返回最新 entry。 */
export async function setRoomPublishMode(
  paths: AgentForumPaths,
  input: {
    forumId: string;
    roomId: string;
    mode: PublishMode;
    now?: Date;
  },
): Promise<{ entry: PublishPolicyEntry; state: PublishPolicyState }> {
  const state = await loadPublishPolicy(paths);
  const entry: PublishPolicyEntry = {
    forumId: input.forumId,
    roomId: input.roomId,
    mode: input.mode,
    updatedAt: currentUtcTimestamp(input.now),
  };
  const next: PublishPolicyState = {
    formatVersion: 1,
    entries: [
      ...state.entries.filter((candidate) => entryKey(candidate) !== entryKey(entry)),
      entry,
    ],
  };
  validatePolicySemantics(next);
  await writeValidatedJsonAtomic(
    paths.publishPolicyFile,
    "publish-policy",
    next,
    { overwrite: true, mode: 0o600 },
  );
  return { entry, state: next };
}

/** 移除房间的显式投递模式，恢复默认 auto。 */
export async function removeRoomPublishMode(
  paths: AgentForumPaths,
  forumId: string,
  roomId: string,
): Promise<{ removed: boolean; state: PublishPolicyState }> {
  const state = await loadPublishPolicy(paths);
  const key = `${forumId}\0${roomId}`;
  const next: PublishPolicyState = {
    formatVersion: 1,
    entries: state.entries.filter(
      (candidate) => entryKey(candidate) !== key,
    ),
  };
  const removed = next.entries.length !== state.entries.length;
  await writeValidatedJsonAtomic(
    paths.publishPolicyFile,
    "publish-policy",
    next,
    { overwrite: true, mode: 0o600 },
  );
  return { removed, state: next };
}

/**
 * 写操作前拦截：目标房间为 ask（授权发送）时抛错，阻止任何本地 commit 与 push。
 * 拦截语义是防止 AI 忘记/绕过；用户确认后的重试由 Skill 流程保证诚实性。
 */
export async function assertRoomPublishAllowed(
  forumAlias: string,
  room: string,
  paths: AgentForumPaths,
): Promise<void> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const roomView = await showRoom(forumAlias, room, paths);
  const mode = await getRoomPublishMode(
    paths,
    registration.forumId,
    roomView.room.id,
  );
  if (mode === "ask") {
    throw new ServiceError(
      "SEND_AUTHORIZATION_REQUIRED",
      `room ${roomView.room.slug} requires user authorization before publishing`,
      {
        forumId: registration.forumId,
        roomId: roomView.room.id,
        roomSlug: roomView.room.slug,
      },
    );
  }
}
