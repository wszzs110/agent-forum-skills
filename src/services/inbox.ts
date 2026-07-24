import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  findForum,
  findIdentity,
  loadLocalConfig,
} from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumStatePath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { ServiceError } from "./errors.js";
import { syncForum, type ForumSyncResult } from "./forum-sync.js";
import { listIdentityAttention } from "./identity-attention.js";
import { listWatchedThreadIds } from "./thread-watch.js";
import { getForumSnapshot } from "./timeline-cache.js";
import {
  listRooms,
  protocolWarning,
  readJsonDocument,
  type ProtocolWarning,
} from "./room.js";
import { listThreads, showThread } from "./thread.js";

interface InboxCursor {
  formatVersion: 1;
  forumId: string;
  memberId: string;
  seenIds: string[];
  updatedAt: string;
}

export interface InboxEntry {
  id: string;
  kind: "message" | "event";
  roomId: string;
  roomSlug: string;
  threadId: string | null;
  type: string;
  actorId: string;
  createdAt: string;
  summary: string;
  replyTo: string | null;
  mentions: string[];
  audience?: "broadcast";
  relevance: "direct" | "watched" | "priority" | "discovery";
  reasons: string[];
  summaryTruncated: boolean;
}

function cursorPath(paths: AgentForumPaths, forumId: string, memberId: string) {
  return resolve(forumStatePath(paths, forumId), "cursors", `${memberId}.json`);
}

async function loadCursor(
  paths: AgentForumPaths,
  forumId: string,
  memberId: string,
): Promise<InboxCursor> {
  const path = cursorPath(paths, forumId, memberId);
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    const validation = validateProtocolDocument("inbox-cursor", value);
    if (!validation.ok || value.forumId !== forumId || value.memberId !== memberId) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `inbox cursor is invalid: ${path}`,
        validation.ok ? undefined : validation.issues,
      );
    }
    return value as InboxCursor;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        formatVersion: 1,
        forumId,
        memberId,
        seenIds: [],
        updatedAt: currentUtcTimestamp(),
      };
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `inbox cursor contains invalid JSON: ${path}`,
    );
  }
}

async function readEvents(
  directory: string,
  roomId: string,
  roomSlug: string,
  threadId: string | null,
  actorId: string,
  activeSince: string,
): Promise<{ entries: InboxEntry[]; warnings: ProtocolWarning[] }> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { entries: [], warnings: [] };
    }
    throw error;
  }
  const entries: InboxEntry[] = [];
  const warnings: ProtocolWarning[] = [];
  for (const name of names) {
    const path = resolve(directory, name, "event.json");
    try {
      const event = await readJsonDocument(path, "event");
      if (String(event.createdAt) >= activeSince) {
        entries.push({
          id: String(event.id),
          kind: "event",
          roomId,
          roomSlug,
          threadId,
          type: String(event.type),
          actorId: String(event.actorId),
          createdAt: String(event.createdAt),
          summary: String(event.reason),
          replyTo: null,
          mentions: [],
          relevance: "discovery",
          reasons: [],
          summaryTruncated: false,
        });
      }
    } catch (error) {
      warnings.push(protocolWarning(path, error));
    }
  }
  return { entries, warnings };
}

async function collectRelevantEntries(
  forumAlias: string,
  memberId: string,
  paths: AgentForumPaths,
): Promise<{ entries: InboxEntry[]; warnings: ProtocolWarning[] }> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const rooms = await listRooms(forumAlias, paths);
  const entries: InboxEntry[] = [];
  const warnings = [...rooms.warnings];
  for (const room of rooms.rooms) {
    const membershipPath = resolve(
      registration.path,
      "rooms",
      room.id,
      "members",
      `${memberId}.json`,
    );
    let membership;
    try {
      membership = await readJsonDocument(membershipPath, "room-member");
    } catch (error) {
      if (
        error instanceof StorageError &&
        typeof error.details === "string" &&
        error.details.includes("ENOENT")
      ) continue;
      warnings.push(protocolWarning(membershipPath, error));
      continue;
    }
    if (membership.status !== "active") continue;
    const activeSince = String(membership.updatedAt);
    const roomEvents = await readEvents(
      resolve(registration.path, "rooms", room.id, "events"),
      room.id,
      room.slug,
      null,
      memberId,
      activeSince,
    );
    entries.push(...roomEvents.entries);
    warnings.push(...roomEvents.warnings);

    const threads = await listThreads(forumAlias, room.id, paths);
    warnings.push(...threads.warnings);
    for (const thread of threads.threads) {
      const detail = await showThread(forumAlias, room.id, thread.id, paths);
      warnings.push(...detail.warnings);
      for (const message of detail.messages) {
        if (message.createdAt < activeSince) continue;
        const compact = message.body.replace(/\s+/gu, " ").trim();
        entries.push({
          id: message.id,
          kind: "message",
          roomId: room.id,
          roomSlug: room.slug,
          threadId: thread.id,
          type: message.type,
          actorId: message.authorId,
          createdAt: message.createdAt,
          summary: compact.length > 500 ? `${compact.slice(0, 497)}...` : compact,
          replyTo: message.replyTo,
          mentions: message.mentions,
          ...(message.audience === "broadcast" ? { audience: "broadcast" as const } : {}),
          relevance: "discovery",
          reasons: [],
          summaryTruncated: compact.length > 500,
        });
      }
      const threadEvents = await readEvents(
        resolve(
          registration.path,
          "rooms",
          room.id,
          "threads",
          thread.id,
          "events",
        ),
        room.id,
        room.slug,
        thread.id,
        memberId,
        activeSince,
      );
      entries.push(...threadEvents.entries);
      warnings.push(...threadEvents.warnings);
    }
  }
  const unique = new Map(entries.map((entry) => [entry.id, entry]));
  return { entries: [...unique.values()], warnings };
}

function classifyEntries(entries: InboxEntry[], attentionIds: Set<string>, watchedIds: Set<string>): InboxEntry[] {
  const authorByMessageId = new Map(entries.filter((entry) => entry.kind === "message").map((entry) => [entry.id, entry.actorId]));
  const priorityTypes = new Set(["blocker", "question", "proposal", "decision", "objection", "thread-closed", "thread-reopened"]);
  return entries.map((entry) => {
    const reasons: string[] = [];
    if (entry.kind === "message" && entry.mentions.some((id) => attentionIds.has(id))) reasons.push("mention");
    if (entry.replyTo && attentionIds.has(authorByMessageId.get(entry.replyTo) ?? "")) reasons.push("reply-to-attention");
    if (reasons.length > 0) return { ...entry, relevance: "direct", reasons };
    if (entry.threadId && watchedIds.has(entry.threadId)) return { ...entry, relevance: "watched", reasons: ["watched-thread"] };
    if (priorityTypes.has(entry.type)) return { ...entry, relevance: "priority", reasons: ["priority-type"] };
    return { ...entry, relevance: "discovery", reasons };
  });
}

export async function getAllUnreadInboxEntries(
  input: { forumAlias: string; identityId?: string; sync?: boolean },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ entries: InboxEntry[]; warnings: ProtocolWarning[]; sync: ForumSyncResult | null }> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const publicProfile = await readJsonDocument(
    resolve(registration.path, "members", identity.memberId, "profile.json"),
    "member-profile",
  );
  if (publicProfile.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active Forum member: ${identity.memberId}`,
    );
  }
  const sync = input.sync ? await syncForum(input.forumAlias, paths) : null;
  const [collected, cursor, attention, watches] = await Promise.all([
    collectRelevantEntries(input.forumAlias, identity.memberId, paths),
    loadCursor(paths, registration.forumId, identity.memberId),
    listIdentityAttention({ forumAlias: input.forumAlias, ownerMemberId: identity.memberId }, paths),
    listWatchedThreadIds({ forumAlias: input.forumAlias, identityId: identity.memberId }, paths),
  ]);
  const attentionIds = new Set([identity.memberId, ...attention.links.filter((link) => link.active).map((link) => link.subjectMemberId)]);
  const seen = new Set(cursor.seenIds);
  return {
    entries: classifyEntries(collected.entries, attentionIds, new Set(watches.threadIds))
      .filter((entry) => entry.actorId !== identity.memberId && !seen.has(entry.id))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)),
    warnings: collected.warnings,
    sync,
  };
}

function balancedPage(entries: InboxEntry[], limit: number): InboxEntry[] {
  const ordered = [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  if (limit < 3) return ordered.slice(0, limit);
  const discoveryQuota = Math.min(Math.max(2, Math.ceil(limit * 0.2)), limit - 1);
  const discovery = ordered.filter((entry) => entry.relevance === "discovery").slice(0, discoveryQuota);
  const selected = new Set(discovery.map((entry) => entry.id));
  return [...ordered.filter((entry) => !selected.has(entry.id)).slice(0, limit - discovery.length), ...discovery]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

export async function showInboxEntry(
  input: { forumAlias: string; identityId?: string; id: string },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ entry: InboxEntry; content: { body?: string; reason?: string; data?: unknown }; cache: "hit" | "incremental" | "rebuilt" | "fallback" }> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const profile = await readJsonDocument(resolve(registration.path, "members", identity.memberId, "profile.json"), "member-profile");
  if (profile.status !== "active") throw new ServiceError("FORUM_MEMBERSHIP_REQUIRED", `identity is not an active Forum member: ${identity.memberId}`);
  const collected = await collectRelevantEntries(input.forumAlias, identity.memberId, paths);
  const entry = collected.entries.find((item) => item.id === input.id);
  if (!entry) throw new ServiceError("MESSAGE_NOT_FOUND", `inbox entry was not found or is outside active Room membership: ${input.id}`);
  try {
    const cached = await getForumSnapshot(input.forumAlias, paths);
    const item = cached.snapshot.rooms.flatMap((room) => [...room.events, ...room.threads.flatMap((thread) => thread.timeline)]).find((candidate) => candidate.id === entry.id);
    if (item?.kind === "message") return { entry, content: { body: item.body }, cache: cached.cache };
    if (item?.kind === "event") return { entry, content: { reason: item.reason, data: item.data }, cache: cached.cache };
  } catch {
    // 缓存仅用于加速；任意缓存问题均回退到协议读取。
  }
  if (entry.kind === "message" && entry.threadId) {
    const detail = await showThread(input.forumAlias, entry.roomId, entry.threadId, paths);
    const message = detail.messages.find((item) => item.id === entry.id);
    if (!message) throw new ServiceError("MESSAGE_NOT_FOUND", `message was not found: ${entry.id}`);
    return { entry, content: { body: message.body }, cache: "fallback" as const };
  }
  const eventPath = entry.threadId
    ? resolve(registration.path, "rooms", entry.roomId, "threads", entry.threadId, "events", entry.id, "event.json")
    : resolve(registration.path, "rooms", entry.roomId, "events", entry.id, "event.json");
  const event = await readJsonDocument(eventPath, "event");
  return { entry, content: { reason: String(event.reason), data: event.data }, cache: "fallback" as const };
}

export async function getInbox(
  input: {
    forumAlias: string;
    identityId?: string;
    sync?: boolean;
    limit?: number;
    markRead?: boolean;
    markAllRead?: boolean;
    summaryChars?: number;
  },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{
  entries: InboxEntry[];
  totalUnread: number;
  relevanceCounts: { direct: number; watched: number; priority: number; discovery: number };
  hasMore: boolean;
  markedRead: number;
  warnings: ProtocolWarning[];
  sync: ForumSyncResult | null;
}> {
  const limit = input.limit ?? 20;
  const summaryChars = input.summaryChars ?? 180;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StorageError("SCHEMA_VALIDATION_FAILED", "inbox limit must be between 1 and 100");
  }
  if (!Number.isInteger(summaryChars) || summaryChars < 0 || summaryChars > 500) {
    throw new StorageError("SCHEMA_VALIDATION_FAILED", "inbox summaryChars must be between 0 and 500");
  }
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const publicProfile = await readJsonDocument(
    resolve(registration.path, "members", identity.memberId, "profile.json"),
    "member-profile",
  );
  if (publicProfile.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active Forum member: ${identity.memberId}`,
    );
  }
  const syncResult = input.sync ? await syncForum(input.forumAlias, paths) : null;
  const [collected, cursor, attention, watches] = await Promise.all([
    collectRelevantEntries(input.forumAlias, identity.memberId, paths),
    loadCursor(paths, registration.forumId, identity.memberId),
    listIdentityAttention({ forumAlias: input.forumAlias, ownerMemberId: identity.memberId }, paths),
    listWatchedThreadIds({ forumAlias: input.forumAlias, identityId: identity.memberId }, paths),
  ]);
  const seen = new Set(cursor.seenIds);
  const attentionIds = new Set([identity.memberId, ...attention.links.filter((link) => link.active).map((link) => link.subjectMemberId)]);
  const unread = classifyEntries(collected.entries, attentionIds, new Set(watches.threadIds))
    .filter((entry) => entry.actorId !== identity.memberId && !seen.has(entry.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const page = balancedPage(unread, limit);
  const idsToMark = input.markAllRead
    ? unread.map((entry) => entry.id)
    : input.markRead
      ? page.map((entry) => entry.id)
      : [];
  if (idsToMark.length > 0) {
    const lock = await acquireForumLock({
      lockPath: resolve(
        paths.locksDirectory,
        `${registration.forumId}-${identity.memberId}-cursor.lock`,
      ),
      command: "inbox mark read",
    });
    try {
      const latest = await loadCursor(paths, registration.forumId, identity.memberId);
      const nextSeen = [...new Set([...latest.seenIds, ...idsToMark])];
      await writeValidatedJsonAtomic(
        cursorPath(paths, registration.forumId, identity.memberId),
        "inbox-cursor",
        {
          formatVersion: 1,
          forumId: registration.forumId,
          memberId: identity.memberId,
          seenIds: nextSeen,
          updatedAt: currentUtcTimestamp(),
        },
        { overwrite: true, mode: 0o600 },
      );
    } finally {
      await lock.release();
    }
  }
  const relevanceCounts = { direct: 0, watched: 0, priority: 0, discovery: 0 };
  for (const entry of unread) relevanceCounts[entry.relevance] += 1;
  const displayed = page.map((entry) => {
    const truncated = entry.summary.length > summaryChars;
    return {
      ...entry,
      summary: summaryChars === 0 ? "" : truncated ? `${entry.summary.slice(0, Math.max(0, summaryChars - 3))}...` : entry.summary,
      summaryTruncated: entry.summaryTruncated || truncated,
    };
  });
  return {
    entries: input.markAllRead ? [] : displayed,
    totalUnread: unread.length,
    relevanceCounts,
    hasMore: unread.length > page.length,
    markedRead: idsToMark.length,
    warnings: collected.warnings,
    sync: syncResult,
  };
}
