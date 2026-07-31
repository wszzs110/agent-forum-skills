import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { findForum, loadLocalConfig } from "../config/local-config.js";
import { requireGit, runGit } from "../git/runner.js";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock, type ForumLockHandle } from "../storage/lock.js";
import { StorageError } from "../storage/errors.js";
import { createAgentForumPaths, forumStatePath, type AgentForumPaths } from "../storage/paths.js";
import { showForum, type ForumView } from "./forum-lifecycle.js";
import { listRooms, readJsonDocument, type ProtocolWarning, type RoomView } from "./room.js";
import { listThreads, showThread, type MessageView, type ThreadView } from "./thread.js";

export interface TimelineEvent {
  id: string;
  kind: "event";
  type: string;
  actorId: string;
  createdAt: string;
  reason: string;
  data: Record<string, unknown>;
}

export interface TimelineMessage extends MessageView {
  kind: "message";
}

export type TimelineItem = TimelineEvent | TimelineMessage;

export interface CachedThread {
  thread: ThreadView;
  timeline: TimelineItem[];
}

export interface CachedRoom {
  room: RoomView;
  sourceHead: string;
  members: Record<string, { role: string; responsibility: string; status: string; updatedAt?: string }>;
  events: TimelineEvent[];
  threads: CachedThread[];
}

export interface ForumSnapshot {
  formatVersion: 1;
  forumAlias: string;
  forumId: string;
  sourceHead: string;
  generatedAt: string;
  forum: ForumView;
  members: Record<string, { displayName: string; role: string; responsibility: string; status: string }>;
  rooms: CachedRoom[];
  warnings: ProtocolWarning[];
}

const cacheRebuildWaitMs = 10_000;
const cacheRebuildRetryMs = 50;

type CacheRebuildLockResult =
  | { kind: "locked"; lock: ForumLockHandle }
  | { kind: "cached"; snapshot: ForumSnapshot };

function cachePath(paths: AgentForumPaths, forumId: string): string {
  return resolve(forumStatePath(paths, forumId), "cache", "snapshot.json");
}

function sanitizeWarnings(repository: string, warnings: ProtocolWarning[]): ProtocolWarning[] {
  return warnings.map((warning) => {
    const local = relative(repository, warning.path).replaceAll("\\", "/");
    return {
      ...warning,
      path: local && !local.startsWith("..") ? local : "<outside-forum>",
    };
  });
}

// 同一损坏路径会经 list/show 的嵌套读取重复上报；快照只保留一条可定位诊断。
function deduplicateWarnings(warnings: ProtocolWarning[]): ProtocolWarning[] {
  const unique = new Map<string, ProtocolWarning>();
  for (const warning of warnings) {
    const key = `${warning.code}\u0000${warning.path}\u0000${warning.message}`;
    if (!unique.has(key)) unique.set(key, warning);
  }
  return [...unique.values()];
}

async function readEventDirectory(directory: string): Promise<TimelineEvent[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const events: TimelineEvent[] = [];
  for (const name of names) {
    try {
      const event = await readJsonDocument(resolve(directory, name, "event.json"), "event");
      events.push({
        id: String(event.id),
        kind: "event",
        type: String(event.type),
        actorId: String(event.actorId),
        createdAt: String(event.createdAt),
        reason: String(event.reason),
        data: event.data as Record<string, unknown>,
      });
    } catch {
      // warnings 由正式 Room/Thread reader 提供，缓存不重复制造第二套诊断。
    }
  }
  return events.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

async function readRoomMembers(repository: string, roomId: string): Promise<CachedRoom["members"]> {
  const members: CachedRoom["members"] = {};
  const directory = resolve(repository, "rooms", roomId, "members");
  let names: string[] = [];
  try { names = await readdir(directory); } catch { return members; }
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    try {
      // Room membership 按“一名成员一个 JSON 文件”存储，不是目录内 membership.json。
      const membership = await readJsonDocument(resolve(directory, name), "room-member");
      members[String(membership.memberId)] = {
        role: String(membership.role),
        responsibility: String(membership.responsibility),
        status: String(membership.status),
        updatedAt: String(membership.updatedAt),
      };
    } catch {
      // 正式 reader 负责损坏记录 warning。
    }
  }
  return members;
}

async function buildRoom(
  forumAlias: string,
  repository: string,
  room: RoomView,
  head: string,
  paths: AgentForumPaths,
): Promise<{ cached: CachedRoom; warnings: ProtocolWarning[] }> {
  const threads = await listThreads(forumAlias, room.id, paths);
  const cachedThreads: CachedThread[] = [];
  const warnings = [...threads.warnings];
  for (const thread of threads.threads) {
    const detail = await showThread(forumAlias, room.id, thread.id, paths);
    warnings.push(...detail.warnings);
    const events = await readEventDirectory(
      resolve(repository, "rooms", room.id, "threads", thread.id, "events"),
    );
    const timeline: TimelineItem[] = [
      ...detail.messages.map((message) => ({ ...message, kind: "message" as const })),
      ...events,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    cachedThreads.push({ thread: detail.thread, timeline });
  }
  cachedThreads.sort(
    (a, b) =>
      b.thread.lastActivityAt.localeCompare(a.thread.lastActivityAt) ||
      a.thread.id.localeCompare(b.thread.id),
  );
  return {
    cached: {
      room,
      sourceHead: head,
      members: await readRoomMembers(repository, room.id),
      events: await readEventDirectory(resolve(repository, "rooms", room.id, "events")),
      threads: cachedThreads,
    },
    warnings,
  };
}

async function readMembers(repository: string) {
  const members: ForumSnapshot["members"] = {};
  const directory = resolve(repository, "members");
  let names: string[] = [];
  try {
    names = await readdir(directory);
  } catch {
    return members;
  }
  for (const name of names) {
    try {
      const profile = await readJsonDocument(resolve(directory, name, "profile.json"), "member-profile");
      members[name] = {
        displayName: String(profile.displayName),
        role: String(profile.role),
        responsibility: String(profile.responsibility),
        status: String(profile.status),
      };
    } catch {
      // 主读取模型的 warnings 负责报告损坏 profile。
    }
  }
  return members;
}

async function loadCache(path: string): Promise<ForumSnapshot | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<ForumSnapshot>;
    const compatible = value.formatVersion === 1 &&
      typeof value.sourceHead === "string" &&
      Array.isArray(value.rooms) &&
      value.rooms.every((room) => room && typeof room === "object" && "members" in room && Object.values(room.members).every((member) => member && typeof member.updatedAt === "string")) &&
      value.members && Object.values(value.members).every((member) => member && typeof member.responsibility === "string");
    return compatible ? (value as ForumSnapshot) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 判断失败是否仅表示另一进程正在重建同一 Forum 的本机缓存。
 */
function isCacheRebuildLocked(error: unknown): error is StorageError {
  return error instanceof StorageError && error.code === "LOCAL_LOCKED";
}

/**
 * 对并发只读请求短暂合并：优先复用另一进程写入的同 HEAD 缓存，锁释放但未写入时再自行重建。
 */
async function acquireCacheRebuildLock(
  lockPath: string,
  snapshotPath: string,
  head: string,
): Promise<CacheRebuildLockResult> {
  const deadline = Date.now() + cacheRebuildWaitMs;
  let lastLockError: StorageError | undefined;
  while (true) {
    const existing = await loadCache(snapshotPath);
    if (existing?.sourceHead === head) return { kind: "cached", snapshot: existing };
    try {
      return {
        kind: "locked",
        lock: await acquireForumLock({ lockPath, command: "cache rebuild" }),
      };
    } catch (error) {
      if (!isCacheRebuildLocked(error)) throw error;
      lastLockError = error;
      const refreshed = await loadCache(snapshotPath);
      if (refreshed?.sourceHead === head) return { kind: "cached", snapshot: refreshed };
      if (Date.now() >= deadline) throw lastLockError;
      await new Promise((resolveWait) => setTimeout(resolveWait, cacheRebuildRetryMs));
    }
  }
}

function affectedRooms(repository: string, oldHead: string, newHead: string): Set<string> | undefined {
  const diff = runGit(repository, ["diff", "--name-only", `${oldHead}..${newHead}`]);
  if (diff.status !== 0) return undefined;
  const ids = new Set<string>();
  for (const path of diff.stdout.split(/\r?\n/u)) {
    const match = /^rooms\/([^/]+)\//u.exec(path.replaceAll("\\", "/"));
    if (match?.[1]) ids.add(match[1]);
  }
  return ids;
}

export async function getForumSnapshot(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ snapshot: ForumSnapshot; cache: "hit" | "incremental" | "rebuilt" }> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const head = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
  const path = cachePath(paths, registration.forumId);
  const existing = await loadCache(path);
  if (existing?.sourceHead === head) return { snapshot: existing, cache: "hit" };
  const acquisition = await acquireCacheRebuildLock(
    resolve(paths.locksDirectory, `${registration.forumId}-cache.lock`),
    path,
    head,
  );
  if (acquisition.kind === "cached") return { snapshot: acquisition.snapshot, cache: "hit" };
  try {
    const latest = await loadCache(path);
    if (latest?.sourceHead === head) return { snapshot: latest, cache: "hit" };
    const affected = latest ? affectedRooms(registration.path, latest.sourceHead, head) : undefined;
    const [forum, rooms] = await Promise.all([
      showForum(forumAlias, paths),
      listRooms(forumAlias, paths),
    ]);
    const oldRooms = new Map((latest?.rooms ?? []).map((room) => [room.room.id, room]));
    const cachedRooms: CachedRoom[] = [];
    const warnings = [...forum.warnings, ...rooms.warnings];
    for (const room of rooms.rooms) {
      const preserved = affected && !affected.has(room.id) ? oldRooms.get(room.id) : undefined;
      if (preserved) cachedRooms.push(preserved);
      else {
        const built = await buildRoom(forumAlias, registration.path, room, head, paths);
        cachedRooms.push(built.cached);
        warnings.push(...built.warnings);
      }
    }
    cachedRooms.sort((a, b) => a.room.slug.localeCompare(b.room.slug));
    const snapshot: ForumSnapshot = {
      formatVersion: 1,
      forumAlias,
      forumId: registration.forumId,
      sourceHead: head,
      generatedAt: new Date().toISOString(),
      forum: forum.forum,
      members: await readMembers(registration.path),
      rooms: cachedRooms,
      warnings: deduplicateWarnings(sanitizeWarnings(registration.path, warnings)),
    };
    await writeJsonAtomic(path, snapshot, { overwrite: true, mode: 0o600 });
    return { snapshot, cache: latest && affected ? "incremental" : "rebuilt" };
  } finally {
    await acquisition.lock.release();
  }
}
