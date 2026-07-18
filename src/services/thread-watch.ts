import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findForum, findIdentity, loadLocalConfig } from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, forumStatePath, type AgentForumPaths } from "../storage/paths.js";

interface ThreadWatchState { schemaVersion: "1.0"; forumId: string; memberId: string; threadIds: string[]; updatedAt: string; }
function path(paths: AgentForumPaths, forumId: string, memberId: string) { return resolve(forumStatePath(paths, forumId), "watches", `${memberId}.json`); }
async function state(paths: AgentForumPaths, forumId: string, memberId: string): Promise<ThreadWatchState> {
  try {
    const value = JSON.parse(await readFile(path(paths, forumId, memberId), "utf8"));
    const valid = validateProtocolDocument("thread-watch", value);
    if (!valid.ok || value.forumId !== forumId || value.memberId !== memberId) throw new StorageError("SCHEMA_VALIDATION_FAILED", "thread watch state is invalid");
    return value as ThreadWatchState;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { schemaVersion: "1.0", forumId, memberId, threadIds: [], updatedAt: currentUtcTimestamp() };
    throw error;
  }
}
async function target(forumAlias: string, identityId: string | undefined, paths: AgentForumPaths) {
  const config = await loadLocalConfig(paths); const forum = findForum(config, forumAlias); const identity = findIdentity(config, identityId); return { forumId: forum.forumId, memberId: identity.memberId };
}
export async function listWatchedThreadIds(input: { forumAlias: string; identityId?: string }, paths = createAgentForumPaths()) {
  const item = await target(input.forumAlias, input.identityId, paths); return { ...item, threadIds: (await state(paths, item.forumId, item.memberId)).threadIds };
}
export async function setThreadWatch(input: { forumAlias: string; identityId?: string; threadId: string; watch: boolean }, paths = createAgentForumPaths()) {
  const item = await target(input.forumAlias, input.identityId, paths);
  const lock = await acquireForumLock({ lockPath: resolve(paths.locksDirectory, `watch-${item.forumId}-${item.memberId}.lock`), command: input.watch ? "thread watch" : "thread unwatch" });
  try {
    const existing = await state(paths, item.forumId, item.memberId);
    const contains = existing.threadIds.includes(input.threadId);
    const threadIds = input.watch ? (contains ? existing.threadIds : [...existing.threadIds, input.threadId]) : existing.threadIds.filter((id) => id !== input.threadId);
    if (contains === input.watch) return { changed: false, ...item, threadIds };
    await writeValidatedJsonAtomic(path(paths, item.forumId, item.memberId), "thread-watch", { ...existing, threadIds, updatedAt: currentUtcTimestamp() }, { overwrite: true, mode: 0o600 });
    return { changed: true, ...item, threadIds };
  } finally { await lock.release(); }
}
