import { readFile, readdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type {
  LocalForumRegistration,
  LocalIdentity,
} from "../config/local-config.js";
import { createEntityId, isEntityId } from "../domain/ids.js";
import {
  isKnownMessageType,
  type KnownMessageType,
} from "../domain/message-types.js";
import {
  applyLifecycleEvent,
  isKnownLifecycleEventType,
  type LifecycleEventInput,
  type ThreadState,
} from "../domain/state-transitions.js";
import {
  isKnownThreadKind,
  type KnownThreadKind,
} from "../domain/thread-kinds.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { commitPaths, runGit } from "../git/runner.js";
import {
  createImmutableDirectory,
  writeValidatedJsonAtomic,
} from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import {
  createImmutableEvent,
  createImmutableMessage,
} from "../storage/protocol-store.js";
import { ServiceError } from "./errors.js";
import { assertRoomPublishAllowed } from "./publish-policy.js";
import {
  openForum,
  protocolWarning,
  readJsonDocument,
  requireActiveRoomMember,
  showRoom,
  withForumWrite,
  type ProtocolWarning,
  type RoomView,
} from "./room.js";

export interface MessageView {
  id: string;
  threadId: string;
  authorId: string;
  type: string;
  createdAt: string;
  replyTo: string | null;
  mentions: string[];
  references: Array<{ kind: string; value: string }>;
  audience?: "broadcast";
  body: string;
}

export interface ThreadView {
  id: string;
  roomId: string;
  title: string;
  kind: KnownThreadKind;
  status: "open" | "closed";
  createdBy: string;
  createdAt: string;
  firstMessageId: string;
  lastActivityAt: string;
  messageCount: number;
}

export interface ThreadListResult {
  room: RoomView;
  threads: ThreadView[];
  warnings: ProtocolWarning[];
}

export interface ThreadDetailResult {
  room: RoomView;
  thread: ThreadView;
  messages: MessageView[];
  warnings: ProtocolWarning[];
}

export interface CreateThreadInput {
  forumAlias: string;
  room: string;
  title: string;
  kind: KnownThreadKind | string;
  body: string;
  identityId?: string;
  threadId?: string;
  messageId?: string;
  broadcast?: boolean;
  now?: Date;
}

export interface CreatePostInput {
  forumAlias: string;
  room: string;
  thread: string;
  type: KnownMessageType | string;
  body: string;
  replyTo?: string | null;
  mentions?: string[];
  references?: Array<{ kind: string; value: string }>;
  identityId?: string;
  messageId?: string;
  broadcast?: boolean;
  now?: Date;
}

export interface ThreadEventInput {
  forumAlias: string;
  room: string;
  thread: string;
  type: "thread-renamed" | "thread-closed" | "thread-reopened";
  reason: string;
  data: Record<string, unknown>;
  identityId?: string;
  eventId?: string;
  now?: Date;
}

function structuralWarning(
  code: string,
  path: string,
  message: string,
): ProtocolWarning {
  return { code, path, message };
}

async function readThreadEvents(
  registration: LocalForumRegistration,
  roomId: string,
  threadId: string,
): Promise<{
  events: Array<Record<string, unknown>>;
  warnings: ProtocolWarning[];
}> {
  const directory = resolve(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadId,
    "events",
  );
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { events: [], warnings: [] };
    }
    throw error;
  }

  const events: Array<Record<string, unknown>> = [];
  const warnings: ProtocolWarning[] = [];
  for (const entry of entries) {
    const eventPath = resolve(directory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push(
        structuralWarning(
          "INVALID_EVENT_PATH",
          resolve(directory, entry.name),
          "thread event path is not a valid event ID directory",
        ),
      );
      continue;
    }
    try {
      const event = await readJsonDocument(eventPath, "event");
      if (event.id !== entry.name) {
        throw new StorageError(
          "PATH_ID_MISMATCH",
          `event ID does not match its directory: ${eventPath}`,
        );
      }
      events.push(event);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  events.sort((left, right) => {
    const byTime = String(left.createdAt).localeCompare(String(right.createdAt));
    return byTime || String(left.id).localeCompare(String(right.id));
  });
  return { events, warnings };
}

async function readMessageDirectory(
  directory: string,
  threadId: string,
): Promise<{ message?: MessageView; warnings: ProtocolWarning[] }> {
  const metadataPath = resolve(directory, "message.json");
  if (!isEntityId(basename(directory), "message")) {
    return {
      warnings: [
        structuralWarning(
          "INVALID_MESSAGE_PATH",
          directory,
          "message path is not a valid message ID directory",
        ),
      ],
    };
  }
  const directoryId = basename(directory);
  try {
    const metadata = await readJsonDocument(metadataPath, "message");
    if (metadata.id !== directoryId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `message ID does not match its directory: ${metadataPath}`,
      );
    }
    if (metadata.threadId !== threadId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `message threadId does not match its parent thread: ${metadataPath}`,
      );
    }
    const body = await readFile(resolve(directory, "body.md"), "utf8");
    if (body.trim().length === 0 || body.includes("\0")) {
      throw new StorageError(
        "INVALID_MESSAGE_BODY",
        `message body is empty or contains NUL: ${resolve(directory, "body.md")}`,
      );
    }
    const message: MessageView = {
      id: String(metadata.id),
      threadId: String(metadata.threadId),
      authorId: String(metadata.authorId),
      type: String(metadata.type),
      createdAt: String(metadata.createdAt),
      replyTo: metadata.replyTo === null ? null : String(metadata.replyTo),
      mentions: (metadata.mentions as unknown[]).map(String),
      references: (metadata.references as Array<Record<string, unknown>>).map(
        (reference) => ({
          kind: String(reference.kind),
          value: String(reference.value),
        }),
      ),
      ...(metadata.audience === "broadcast" ? { audience: "broadcast" as const } : {}),
      body,
    };
    return {
      message,
      warnings: isKnownMessageType(message.type)
        ? []
        : [
            structuralWarning(
              "UNKNOWN_MESSAGE_TYPE",
              metadataPath,
              `unknown message type: ${message.type}`,
            ),
          ],
    };
  } catch (error) {
    return { warnings: [protocolWarning(metadataPath, error)] };
  }
}

async function readThreadMessages(
  registration: LocalForumRegistration,
  roomId: string,
  threadId: string,
): Promise<{ messages: MessageView[]; warnings: ProtocolWarning[] }> {
  const directory = resolve(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadId,
    "messages",
  );
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { messages: [], warnings: [] };
    }
    throw error;
  }
  const messages: MessageView[] = [];
  const warnings: ProtocolWarning[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (!entry.isDirectory()) {
      warnings.push(
        structuralWarning(
          "INVALID_MESSAGE_PATH",
          path,
          "messages directory contains a non-directory entry",
        ),
      );
      continue;
    }
    const result = await readMessageDirectory(path, threadId);
    if (result.message) messages.push(result.message);
    warnings.push(...result.warnings);
  }
  messages.sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt);
    return byTime || left.id.localeCompare(right.id);
  });
  return { messages, warnings };
}

async function readThreadDirectory(
  registration: LocalForumRegistration,
  roomId: string,
  threadDirectoryName: string,
): Promise<{
  thread?: ThreadView;
  messages: MessageView[];
  warnings: ProtocolWarning[];
}> {
  const directory = resolve(
    registration.path,
    "rooms",
    roomId,
    "threads",
    threadDirectoryName,
  );
  const threadPath = resolve(directory, "thread.json");
  if (!isEntityId(threadDirectoryName, "thread")) {
    return {
      messages: [],
      warnings: [
        structuralWarning(
          "INVALID_THREAD_PATH",
          directory,
          "thread path is not a valid thread ID directory",
        ),
      ],
    };
  }

  let base;
  try {
    base = await readJsonDocument(threadPath, "thread");
    if (base.id !== threadDirectoryName || base.roomId !== roomId) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `thread ID or roomId does not match its path: ${threadPath}`,
      );
    }
    if (!isKnownThreadKind(String(base.kind))) {
      throw new ServiceError(
        "THREAD_KIND_INVALID",
        `unsupported thread kind: ${String(base.kind)}`,
      );
    }
  } catch (error) {
    return {
      messages: [],
      warnings: [protocolWarning(threadPath, error)],
    };
  }

  const messageResult = await readThreadMessages(
    registration,
    roomId,
    threadDirectoryName,
  );
  const warnings = [...messageResult.warnings];
  const messageIds = new Set(
    messageResult.messages.map((message) => message.id),
  );
  for (const message of messageResult.messages) {
    if (message.replyTo === message.id) {
      warnings.push(
        structuralWarning(
          "MESSAGE_SELF_REPLY",
          resolve(directory, "messages", message.id, "message.json"),
          "message replyTo cannot reference itself",
        ),
      );
    } else if (message.replyTo !== null && !messageIds.has(message.replyTo)) {
      warnings.push(
        structuralWarning(
          "REPLY_TARGET_MISSING",
          resolve(directory, "messages", message.id, "message.json"),
          `reply target is missing or damaged: ${message.replyTo}`,
        ),
      );
    }
  }
  const firstMessage = messageResult.messages.find(
    (message) => message.id === base.firstMessageId,
  );
  if (!firstMessage) {
    warnings.push(
      structuralWarning(
        "FIRST_MESSAGE_MISSING",
        threadPath,
        `first message is missing or damaged: ${String(base.firstMessageId)}`,
      ),
    );
  } else {
    if (firstMessage.type !== base.kind) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_TYPE_MISMATCH",
          resolve(directory, "messages", firstMessage.id, "message.json"),
          "first message type does not match thread kind",
        ),
      );
    }
    if (firstMessage.authorId !== base.createdBy) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_AUTHOR_MISMATCH",
          resolve(directory, "messages", firstMessage.id, "message.json"),
          "first message author does not match thread creator",
        ),
      );
    }
    if (firstMessage.replyTo !== null) {
      warnings.push(
        structuralWarning(
          "FIRST_MESSAGE_REPLY_INVALID",
          resolve(directory, "messages", firstMessage.id, "message.json"),
          "first message replyTo must be null",
        ),
      );
    }
  }

  let state: ThreadState = {
    scope: "thread",
    id: String(base.id),
    title: String(base.initialTitle),
    status: "open",
  };
  let lastActivityAt = String(base.createdAt);
  for (const message of messageResult.messages) {
    if (message.createdAt > lastActivityAt) lastActivityAt = message.createdAt;
  }
  const eventResult = await readThreadEvents(
    registration,
    roomId,
    threadDirectoryName,
  );
  warnings.push(...eventResult.warnings);
  for (const event of eventResult.events) {
    const eventPath = resolve(
      directory,
      "events",
      String(event.id),
      "event.json",
    );
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push(
        structuralWarning(
          "UNKNOWN_EVENT_TYPE",
          eventPath,
          `unknown thread event type: ${String(event.type)}`,
        ),
      );
      continue;
    }
    try {
      state = applyLifecycleEvent(state, {
        scope: "thread",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data as Record<string, unknown>,
      });
      if (String(event.createdAt) > lastActivityAt) {
        lastActivityAt = String(event.createdAt);
      }
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }

  return {
    thread: {
      id: String(base.id),
      roomId: String(base.roomId),
      title: state.title,
      kind: base.kind as KnownThreadKind,
      status: state.status,
      createdBy: String(base.createdBy),
      createdAt: String(base.createdAt),
      firstMessageId: String(base.firstMessageId),
      lastActivityAt,
      messageCount: messageResult.messages.length,
    },
    messages: messageResult.messages,
    warnings,
  };
}

export async function listThreads(
  forumAlias: string,
  room: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ThreadListResult> {
  const roomResult = await showRoom(forumAlias, room, paths);
  const { registration } = await openForum(forumAlias, paths);
  const directory = resolve(
    registration.path,
    "rooms",
    roomResult.room.id,
    "threads",
  );
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        room: roomResult.room,
        threads: [],
        warnings: roomResult.warnings,
      };
    }
    throw error;
  }

  const threads: ThreadView[] = [];
  const warnings = [...roomResult.warnings];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (!entry.isDirectory()) {
      warnings.push(
        structuralWarning(
          "INVALID_THREAD_PATH",
          path,
          "threads directory contains a non-directory entry",
        ),
      );
      continue;
    }
    const result = await readThreadDirectory(
      registration,
      roomResult.room.id,
      entry.name,
    );
    if (result.thread) threads.push(result.thread);
    warnings.push(...result.warnings);
  }
  threads.sort((left, right) => {
    const byActivity = right.lastActivityAt.localeCompare(left.lastActivityAt);
    return byActivity || left.id.localeCompare(right.id);
  });
  return { room: roomResult.room, threads, warnings };
}

export async function showThread(
  forumAlias: string,
  room: string,
  threadId: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ThreadDetailResult> {
  const roomResult = await showRoom(forumAlias, room, paths);
  const { registration } = await openForum(forumAlias, paths);
  const result = await readThreadDirectory(
    registration,
    roomResult.room.id,
    threadId,
  );
  if (!result.thread) {
    throw new ServiceError(
      "THREAD_NOT_FOUND",
      `thread was not found: ${threadId}`,
      result.warnings,
    );
  }
  return {
    room: roomResult.room,
    thread: result.thread,
    messages: result.messages,
    warnings: [...roomResult.warnings, ...result.warnings],
  };
}

function assertRoomWritable(room: RoomView): void {
  if (room.status !== "active") {
    throw new ServiceError(
      "ROOM_ARCHIVED",
      `cannot write to archived room: ${room.id}`,
    );
  }
}

export async function createThread(
  input: CreateThreadInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{
  thread: ThreadView;
  firstMessage: MessageView;
  commit: string;
}> {
  if (!isKnownThreadKind(input.kind)) {
    throw new ServiceError(
      "THREAD_KIND_INVALID",
      `unsupported thread kind: ${input.kind}`,
    );
  }
  const kind = input.kind;
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "thread create",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      assertRoomWritable(roomResult.room);
      await requireActiveRoomMember(
        registration,
        roomResult.room.id,
        identity,
      );
      const threadId = input.threadId ?? createEntityId("thread");
      const messageId = input.messageId ?? createEntityId("message");
      const timestamp = currentUtcTimestamp(input.now);
      const thread = {
        schemaVersion: "1.0",
        id: threadId,
        roomId: roomResult.room.id,
        initialTitle: input.title,
        kind,
        createdBy: identity.memberId,
        createdAt: timestamp,
        firstMessageId: messageId,
      };
      const metadata = {
        schemaVersion: "1.0",
        id: messageId,
        threadId,
        authorId: identity.memberId,
        type: kind,
        createdAt: timestamp,
        replyTo: null,
        mentions: [],
        references: [],
        ...(input.broadcast ? { audience: "broadcast" } : {}),
      };
      const threadDirectory = resolve(
        registration.path,
        "rooms",
        roomResult.room.id,
        "threads",
        threadId,
      );
      let directoryCreated = false;
      try {
        await createImmutableDirectory(threadDirectory, async (temporary) => {
          await writeValidatedJsonAtomic(
            resolve(temporary, "thread.json"),
            "thread",
            thread,
          );
          await createImmutableMessage(
            resolve(temporary, "messages", messageId),
            metadata,
            input.body,
          );
        });
        directoryCreated = true;
        const commit = commitPaths(
          registration.path,
          [threadDirectory],
          `Create thread ${input.title}`,
        );
        return {
          thread: {
            id: threadId,
            roomId: roomResult.room.id,
            title: input.title,
            kind,
            status: "open",
            createdBy: identity.memberId,
            createdAt: timestamp,
            firstMessageId: messageId,
            lastActivityAt: timestamp,
            messageCount: 1,
          },
          firstMessage: {
            id: messageId,
            threadId,
            authorId: identity.memberId,
            type: kind,
            createdAt: timestamp,
            replyTo: null,
            mentions: [],
            references: [],
            ...(input.broadcast ? { audience: "broadcast" as const } : {}),
            body: input.body,
          },
          commit,
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", threadDirectory]);
        if (directoryCreated) {
          await rm(threadDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    },
  );
}

function hasStructuralThreadDamage(
  thread: Pick<ThreadView, "id" | "firstMessageId">,
  warnings: ProtocolWarning[],
): boolean {
  return warnings.some((item) => {
    if (!item.path.includes(thread.id)) return false;
    if (item.code.startsWith("FIRST_MESSAGE_")) return true;
    if (
      !["SCHEMA_VALIDATION_FAILED", "PATH_ID_MISMATCH"].includes(item.code)
    ) {
      return false;
    }
    return (
      item.path.endsWith("thread.json") ||
      item.path.includes(thread.firstMessageId)
    );
  });
}

export async function createPost(
  input: CreatePostInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ message: MessageView; thread: ThreadView; commit: string }> {
  if (!isKnownMessageType(input.type)) {
    throw new ServiceError(
      "MESSAGE_TYPE_INVALID",
      `unsupported message type: ${input.type}`,
    );
  }
  const type = input.type;
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.replyTo ? "post reply" : "post create",
    async (registration, identity) => {
      const detail = await showThread(
        input.forumAlias,
        input.room,
        input.thread,
        paths,
      );
      assertRoomWritable(detail.room);
      if (hasStructuralThreadDamage(detail.thread, detail.warnings)) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          `cannot post to damaged thread: ${detail.thread.id}`,
          detail.warnings,
        );
      }
      if (detail.thread.status !== "open") {
        throw new ServiceError(
          "THREAD_CLOSED",
          `cannot post to closed thread: ${detail.thread.id}`,
        );
      }
      await requireActiveRoomMember(
        registration,
        detail.room.id,
        identity,
      );
      const replyTo = input.replyTo ?? null;
      if (
        replyTo !== null &&
        !detail.messages.some((message) => message.id === replyTo)
      ) {
        throw new ServiceError(
          "MESSAGE_NOT_FOUND",
          `reply target was not found in thread ${detail.thread.id}: ${replyTo}`,
        );
      }

      const messageId = input.messageId ?? createEntityId("message");
      const timestamp = currentUtcTimestamp(input.now);
      const metadata = {
        schemaVersion: "1.0",
        id: messageId,
        threadId: detail.thread.id,
        authorId: identity.memberId,
        type,
        createdAt: timestamp,
        replyTo,
        mentions: input.mentions ?? [],
        references: input.references ?? [],
        ...(input.broadcast ? { audience: "broadcast" } : {}),
      };
      const messageDirectory = resolve(
        registration.path,
        "rooms",
        detail.room.id,
        "threads",
        detail.thread.id,
        "messages",
        messageId,
      );
      let messageCreated = false;
      try {
        await createImmutableMessage(
          messageDirectory,
          metadata,
          input.body,
        );
        messageCreated = true;
        const commit = commitPaths(
          registration.path,
          [messageDirectory],
          `${replyTo ? "Reply in" : "Post to"} thread ${detail.thread.id}`,
        );
        const message: MessageView = {
          id: messageId,
          threadId: detail.thread.id,
          authorId: identity.memberId,
          type,
          createdAt: timestamp,
          replyTo,
          mentions: [...(input.mentions ?? [])],
          references: [...(input.references ?? [])],
          ...(input.broadcast ? { audience: "broadcast" as const } : {}),
          body: input.body,
        };
        return {
          message,
          thread: {
            ...detail.thread,
            lastActivityAt:
              timestamp > detail.thread.lastActivityAt
                ? timestamp
                : detail.thread.lastActivityAt,
            messageCount: detail.thread.messageCount + 1,
          },
          commit,
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", messageDirectory]);
        if (messageCreated) {
          await rm(messageDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    },
  );
}

export async function createThreadEvent(
  input: ThreadEventInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ eventId: string; thread: ThreadView; commit: string }> {
  await assertRoomPublishAllowed(input.forumAlias, input.room, paths);
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.type,
    async (registration, identity: LocalIdentity) => {
      const detail = await showThread(
        input.forumAlias,
        input.room,
        input.thread,
        paths,
      );
      assertRoomWritable(detail.room);
      if (hasStructuralThreadDamage(detail.thread, detail.warnings)) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          `cannot update damaged thread: ${detail.thread.id}`,
          detail.warnings,
        );
      }
      await requireActiveRoomMember(
        registration,
        detail.room.id,
        identity,
      );
      const eventId = input.eventId ?? createEntityId("event");
      const timestamp = currentUtcTimestamp(input.now);
      const event = {
        schemaVersion: "1.0",
        id: eventId,
        scope: "thread",
        targetId: detail.thread.id,
        type: input.type,
        actorId: identity.memberId,
        createdAt: timestamp,
        reason: input.reason,
        data: input.data,
      };
      const nextState = applyLifecycleEvent(
        {
          scope: "thread",
          id: detail.thread.id,
          title: detail.thread.title,
          status: detail.thread.status,
        } satisfies ThreadState,
        event as unknown as LifecycleEventInput,
      );
      const eventDirectory = resolve(
        registration.path,
        "rooms",
        detail.room.id,
        "threads",
        detail.thread.id,
        "events",
        eventId,
      );
      let eventCreated = false;
      try {
        await createImmutableEvent(eventDirectory, event);
        eventCreated = true;
        const commit = commitPaths(
          registration.path,
          [eventDirectory],
          `${input.type} ${detail.thread.id}`,
        );
        return {
          eventId,
          thread: {
            ...detail.thread,
            title: nextState.title,
            status: nextState.status,
            lastActivityAt: timestamp,
          },
          commit,
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", eventDirectory]);
        if (eventCreated) {
          await rm(eventDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    },
  );
}
