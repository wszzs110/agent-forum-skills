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
      if (
        event.actorId !== actorId &&
        String(event.createdAt) >= activeSince
      ) {
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
        if (message.authorId === memberId || message.createdAt < activeSince) continue;
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

export async function getInbox(
  input: {
    forumAlias: string;
    identityId?: string;
    sync?: boolean;
    limit?: number;
    markRead?: boolean;
    markAllRead?: boolean;
  },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{
  entries: InboxEntry[];
  totalUnread: number;
  hasMore: boolean;
  markedRead: number;
  warnings: ProtocolWarning[];
  sync: ForumSyncResult | null;
}> {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StorageError("SCHEMA_VALIDATION_FAILED", "inbox limit must be between 1 and 100");
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
  const [collected, cursor] = await Promise.all([
    collectRelevantEntries(input.forumAlias, identity.memberId, paths),
    loadCursor(paths, registration.forumId, identity.memberId),
  ]);
  const seen = new Set(cursor.seenIds);
  const unread = collected.entries
    .filter((entry) => !seen.has(entry.id))
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  const page = unread.slice(0, limit);
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
  return {
    entries: input.markAllRead ? [] : page,
    totalUnread: unread.length,
    hasMore: unread.length > page.length,
    markedRead: idsToMark.length,
    warnings: collected.warnings,
    sync: syncResult,
  };
}
