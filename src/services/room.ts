import {
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { resolve } from "node:path";
import {
  findForum,
  findIdentity,
  loadLocalConfig,
  type LocalForumRegistration,
  type LocalIdentity,
} from "../config/local-config.js";
import { createEntityId, isEntityId } from "../domain/ids.js";
import {
  StateTransitionError,
  applyLifecycleEvent,
  isKnownLifecycleEventType,
  type LifecycleEventInput,
  type RoomState,
} from "../domain/state-transitions.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import {
  assertCleanWorktree,
  commitPaths,
  configureForumCommitIdentity,
  requireGit,
  runGit,
} from "../git/runner.js";
import {
  normalizeProtocolReadDocument,
  validateProtocolDocument,
  type ProtocolSchemaName,
} from "../protocol/validator.js";
import {
  createImmutableDirectory,
  writeFileAtomic,
  writeValidatedJsonAtomic,
} from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumLockPath,
  sameExistingPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { createImmutableEvent } from "../storage/protocol-store.js";
import { ServiceError } from "./errors.js";
import { syncForum, type ForumSyncResult } from "./forum-sync.js";

export interface ProtocolWarning {
  code: string;
  path: string;
  message: string;
}

export interface MemberSummary {
  memberId: string;
  displayName: string;
  role: string;
}

export interface RoomDeprecation {
  state: "deprecated";
  eventId: string;
  changedAt: string;
  changedBy: MemberSummary;
  reason: string;
  replacementRoomId?: string;
}

export interface RoomEventHistoryItem {
  id: string;
  type: string;
  actorId: string;
  createdAt: string;
  reason: string;
  data: Record<string, unknown>;
}

export interface RoomView {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "active" | "archived";
  // 保留历史 createdBy 字段；creator 是面向展示的派生信息。
  createdBy: string;
  creator?: MemberSummary;
  createdAt: string;
  lastActivityAt: string;
  deprecation?: RoomDeprecation;
}

export interface RoomListResult {
  rooms: RoomView[];
  warnings: ProtocolWarning[];
}

export interface RoomMemberView {
  roomId: string;
  memberId: string;
  role: string;
  responsibility: string;
  status: "active" | "left";
  joinedAt: string;
  updatedAt: string;
}

export interface CreateRoomInput {
  forumAlias: string;
  slug: string;
  title: string;
  description: string;
  identityId?: string;
  roomId?: string;
  now?: Date;
}

export interface JoinRoomInput {
  forumAlias: string;
  room: string;
  identityId?: string;
  role?: string;
  responsibility?: string;
  now?: Date;
}

export interface RoomEventInput {
  forumAlias: string;
  room: string;
  type:
    | "room-renamed"
    | "room-description-changed"
    | "room-archived"
    | "room-restored"
    | "room-deprecated"
    | "room-reenabled";
  reason: string;
  data: Record<string, unknown>;
  identityId?: string;
  eventId?: string;
  now?: Date;
}

export interface ForumContext {
  registration: LocalForumRegistration;
}

export interface WriteSynchronization {
  before: ForumSyncResult;
  after: ForumSyncResult;
}

function withWriteSynchronization<T>(
  value: T,
  synchronization: WriteSynchronization | undefined,
): T {
  if (!synchronization || !value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.assign(value as object, { synchronization }) as T;
}

export async function readJsonDocument(
  path: string,
  schema: ProtocolSchemaName,
): Promise<Record<string, unknown>> {
  let value;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `failed to read JSON document: ${path}`,
      error instanceof Error ? error.message : String(error),
    );
  }
  const normalized = normalizeProtocolReadDocument(schema, value);
  const validation = validateProtocolDocument(schema, normalized, { mode: "read" });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `document does not satisfy the ${schema} schema: ${path}`,
      validation.issues,
    );
  }
  return normalized as Record<string, unknown>;
}

export function protocolWarning(path: string, error: unknown): ProtocolWarning {
  if (
    error instanceof StorageError ||
    error instanceof ServiceError ||
    error instanceof StateTransitionError
  ) {
    return { code: error.code, path, message: error.message };
  }
  return {
    code: "PROTOCOL_DATA_DAMAGED",
    path,
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function openForum(
  alias: string,
  paths: AgentForumPaths,
  options: { requireClean?: boolean } = {},
): Promise<ForumContext> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, alias);
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
  const branch = requireGit(registration.path, [
    "branch",
    "--show-current",
  ]).stdout.trim();
  if (branch !== registration.dataBranch) {
    throw new ServiceError(
      "FORUM_PROTOCOL_MISMATCH",
      `managed forum is on '${branch}', expected '${registration.dataBranch}'`,
    );
  }
  if (options.requireClean) assertCleanWorktree(registration.path);

  const protocolPath = resolve(
    registration.path,
    ".forum",
    "protocol.json",
  );
  const protocol = await readJsonDocument(protocolPath, "protocol");
  if (
    protocol.forumId !== registration.forumId ||
    protocol.dataBranch !== registration.dataBranch
  ) {
    throw new ServiceError(
      "FORUM_PROTOCOL_MISMATCH",
      `forum protocol does not match local registration: ${alias}`,
    );
  }
  return { registration };
}

async function readForumMember(
  registration: LocalForumRegistration,
  identity: LocalIdentity,
): Promise<Record<string, unknown>> {
  const path = resolve(
    registration.path,
    "members",
    identity.memberId,
    "profile.json",
  );
  let profile;
  try {
    profile = await readJsonDocument(path, "member-profile");
  } catch (error) {
    if (
      error instanceof StorageError &&
      error.details &&
      typeof error.details === "string" &&
      error.details.includes("ENOENT")
    ) {
      throw new ServiceError(
        "FORUM_MEMBERSHIP_REQUIRED",
        `identity is not published in forum: ${identity.memberId}`,
      );
    }
    throw error;
  }
  if (profile.memberId !== identity.memberId || profile.status !== "active") {
    throw new ServiceError(
      "FORUM_MEMBERSHIP_REQUIRED",
      `identity is not an active forum member: ${identity.memberId}`,
    );
  }
  return profile;
}

async function readMemberSummary(
  registration: LocalForumRegistration,
  memberId: string,
): Promise<MemberSummary> {
  try {
    const profile = await readJsonDocument(
      resolve(registration.path, "members", memberId, "profile.json"),
      "member-profile",
    );
    return {
      memberId,
      displayName: typeof profile.displayName === "string" ? profile.displayName : memberId,
      role: typeof profile.role === "string" ? profile.role : "",
    };
  } catch {
    // 历史 Forum 可能没有完整 profile；展示必须安全降级，不能阻断 Room 读取。
    return { memberId, displayName: memberId, role: "" };
  }
}

async function readRoomEvents(
  registration: LocalForumRegistration,
  roomId: string,
): Promise<{
  events: Array<Record<string, unknown>>;
  warnings: ProtocolWarning[];
}> {
  const eventsDirectory = resolve(
    registration.path,
    "rooms",
    roomId,
    "events",
  );
  let entries;
  try {
    entries = await readdir(eventsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { events: [], warnings: [] };
    }
    throw error;
  }

  const events: Array<Record<string, unknown>> = [];
  const warnings: ProtocolWarning[] = [];
  for (const entry of entries) {
    const eventPath = resolve(eventsDirectory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push({
        code: "INVALID_EVENT_PATH",
        path: resolve(eventsDirectory, entry.name),
        message: "room event path is not a valid event ID directory",
      });
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

async function readRoomDirectory(
  registration: LocalForumRegistration,
  roomDirectoryName: string,
): Promise<{ room?: RoomView; warnings: ProtocolWarning[] }> {
  const roomPath = resolve(
    registration.path,
    "rooms",
    roomDirectoryName,
    "room.json",
  );
  if (!isEntityId(roomDirectoryName, "room")) {
    return {
      warnings: [
        {
          code: "INVALID_ROOM_PATH",
          path: resolve(registration.path, "rooms", roomDirectoryName),
          message: "room path is not a valid room ID directory",
        },
      ],
    };
  }

  let base;
  try {
    base = await readJsonDocument(roomPath, "room");
    if (base.id !== roomDirectoryName) {
      throw new StorageError(
        "PATH_ID_MISMATCH",
        `room ID does not match its directory: ${roomPath}`,
      );
    }
  } catch (error) {
    return { warnings: [protocolWarning(roomPath, error)] };
  }

  let state: RoomState = {
    scope: "room",
    id: String(base.id),
    title: String(base.initialTitle),
    description: String(base.initialDescription),
    status: "active",
  };
  let lastActivityAt = String(base.createdAt);
  let deprecation: RoomDeprecation | undefined;
  const eventResult = await readRoomEvents(registration, roomDirectoryName);
  const warnings = [...eventResult.warnings];
  for (const event of eventResult.events) {
    const eventPath = resolve(
      registration.path,
      "rooms",
      roomDirectoryName,
      "events",
      String(event.id),
      "event.json",
    );
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push({
        code: "UNKNOWN_EVENT_TYPE",
        path: eventPath,
        message: `unknown room event type: ${String(event.type)}`,
      });
      continue;
    }
    try {
      state = applyLifecycleEvent(state, {
        scope: "room",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data as Record<string, unknown>,
      });
      if (event.type === "room-deprecated") {
        const replacementRoomId = (event.data as Record<string, unknown>).replacementRoomId;
        deprecation = {
          state: "deprecated",
          eventId: String(event.id),
          changedAt: String(event.createdAt),
          changedBy: await readMemberSummary(registration, String(event.actorId)),
          reason: String(event.reason),
          ...(typeof replacementRoomId === "string" ? { replacementRoomId } : {}),
        };
      } else if (event.type === "room-reenabled") {
        deprecation = undefined;
      }
      lastActivityAt = String(event.createdAt);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }

  const createdBy = String(base.createdBy);
  if (deprecation) {
    warnings.push({
      code: "ROOM_DEPRECATED",
      path: roomPath,
      message: `room was deprecated by ${deprecation.changedBy.displayName} at ${deprecation.changedAt}`,
    });
  }
  return {
    room: {
      id: String(base.id),
      slug: String(base.slug),
      title: state.title,
      description: state.description,
      status: state.status,
      createdBy,
      creator: await readMemberSummary(registration, createdBy),
      createdAt: String(base.createdAt),
      lastActivityAt,
      ...(deprecation ? { deprecation } : {}),
    },
    warnings,
  };
}

export async function listRooms(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<RoomListResult> {
  const { registration } = await openForum(forumAlias, paths);
  const roomsDirectory = resolve(registration.path, "rooms");
  let entries;
  try {
    entries = await readdir(roomsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { rooms: [], warnings: [] };
    }
    throw error;
  }

  const rooms: RoomView[] = [];
  const warnings: ProtocolWarning[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      warnings.push({
        code: "INVALID_ROOM_PATH",
        path: resolve(roomsDirectory, entry.name),
        message: "rooms directory contains a non-directory entry",
      });
      continue;
    }
    const result = await readRoomDirectory(registration, entry.name);
    if (result.room) rooms.push(result.room);
    warnings.push(...result.warnings);
  }
  rooms.sort((left, right) => left.slug.localeCompare(right.slug));
  return { rooms, warnings };
}

export async function showRoom(
  forumAlias: string,
  room: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ room: RoomView; warnings: ProtocolWarning[]; history: RoomEventHistoryItem[] }> {
  const result = await listRooms(forumAlias, paths);
  const found = result.rooms.find(
    (candidate) => candidate.id === room || candidate.slug === room,
  );
  if (!found) {
    throw new ServiceError(
      "ROOM_NOT_FOUND",
      `room was not found: ${room}`,
      result.warnings,
    );
  }
  const { registration } = await openForum(forumAlias, paths);
  const events = await readRoomEvents(registration, found.id);
  return {
    room: found,
    warnings: result.warnings,
    history: events.events.map((event) => ({
      id: String(event.id),
      type: String(event.type),
      actorId: String(event.actorId),
      createdAt: String(event.createdAt),
      reason: String(event.reason),
      data: event.data as Record<string, unknown>,
    })),
  };
}

export async function withForumWrite<T>(
  forumAlias: string,
  identityId: string | undefined,
  paths: AgentForumPaths,
  command: string,
  operation: (
    registration: LocalForumRegistration,
    identity: LocalIdentity,
  ) => Promise<T>,
): Promise<T> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const identity = findIdentity(config, identityId);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command,
  });
  try {
    // 写操作必须在同一把 Forum 锁中完成“同步前检查 → commit → 发布”，
    // 不能在命令层串联两个独立锁，否则并发 Agent 可在中间插入提交。
    const remoteConfigured = runGit(registration.path, ["remote", "get-url", "origin"]).status === 0;
    const before = remoteConfigured
      ? await syncForum(forumAlias, paths, { lockAlreadyHeld: true })
      : undefined;
    await openForum(forumAlias, paths, { requireClean: true });
    await readForumMember(registration, identity);
    configureForumCommitIdentity(
      registration.path,
      identity.displayName,
      identity.memberId,
    );
    const value = await operation(registration, identity);
    const after = remoteConfigured
      ? await syncForum(forumAlias, paths, { lockAlreadyHeld: true })
      : undefined;
    return withWriteSynchronization(
      value,
      before && after ? { before, after } : undefined,
    );
  } finally {
    await lock.release();
  }
}

function roomMemberDocument(
  roomId: string,
  identity: LocalIdentity,
  role: string,
  responsibility: string,
  status: "active" | "left",
  joinedAt: string,
  updatedAt: string,
): RoomMemberView & { schemaVersion: "1.0" } {
  return {
    schemaVersion: "1.0",
    roomId,
    memberId: identity.memberId,
    role,
    responsibility,
    status,
    joinedAt,
    updatedAt,
  };
}

async function readRoomMember(
  path: string,
): Promise<(RoomMemberView & { schemaVersion: "1.0" }) | undefined> {
  try {
    return (await readJsonDocument(path, "room-member")) as unknown as RoomMemberView & {
      schemaVersion: "1.0";
    };
  } catch (error) {
    if (
      error instanceof StorageError &&
      typeof error.details === "string" &&
      error.details.includes("ENOENT")
    ) {
      return undefined;
    }
    throw error;
  }
}

async function commitMutableDocument(
  repository: string,
  path: string,
  schema: ProtocolSchemaName,
  value: unknown,
  commitMessage: string,
): Promise<string> {
  let previous: string | undefined;
  try {
    previous = await readFile(path, "utf8");
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
  try {
    await writeValidatedJsonAtomic(path, schema, value, { overwrite: true });
    return commitPaths(repository, [path], commitMessage);
  } catch (error) {
    runGit(repository, ["reset", "--", path]);
    if (previous === undefined) await rm(path, { force: true });
    else await writeFileAtomic(path, previous, { overwrite: true });
    throw error;
  }
}

export async function createRoom(
  input: CreateRoomInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ room: RoomView; identityId: string; commit: string }> {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room create",
    async (registration, identity) => {
      const existing = await listRooms(input.forumAlias, paths);
      if (existing.warnings.some((item) => item.code === "SCHEMA_VALIDATION_FAILED")) {
        throw new ServiceError(
          "PROTOCOL_DATA_DAMAGED",
          "cannot safely check room slug uniqueness while room data is damaged",
          existing.warnings,
        );
      }
      if (existing.rooms.some((room) => room.slug === input.slug)) {
        throw new ServiceError(
          "ROOM_SLUG_EXISTS",
          `room slug already exists: ${input.slug}`,
        );
      }

      const id = input.roomId ?? createEntityId("room");
      const timestamp = currentUtcTimestamp(input.now);
      const roomDirectory = resolve(registration.path, "rooms", id);
      const room = {
        schemaVersion: "1.0",
        id,
        slug: input.slug,
        initialTitle: input.title,
        initialDescription: input.description,
        createdBy: identity.memberId,
        createdAt: timestamp,
      };
      const member = roomMemberDocument(
        id,
        identity,
        identity.role,
        identity.responsibility,
        "active",
        timestamp,
        timestamp,
      );

      let directoryCreated = false;
      try {
        await createImmutableDirectory(roomDirectory, async (temporary) => {
          await writeValidatedJsonAtomic(
            resolve(temporary, "room.json"),
            "room",
            room,
          );
          await writeValidatedJsonAtomic(
            resolve(temporary, "members", `${identity.memberId}.json`),
            "room-member",
            member,
          );
        });
        directoryCreated = true;
        const commit = commitPaths(
          registration.path,
          [roomDirectory],
          `Create room ${input.slug}`,
        );
        return {
          room: {
            id,
            slug: input.slug,
            title: input.title,
            description: input.description,
            status: "active",
            createdBy: identity.memberId,
            creator: {
              memberId: identity.memberId,
              displayName: identity.displayName,
              role: identity.role,
            },
            createdAt: timestamp,
            lastActivityAt: timestamp,
          },
          identityId: identity.memberId,
          commit,
        };
      } catch (error) {
        runGit(registration.path, ["reset", "--", roomDirectory]);
        if (directoryCreated) {
          await rm(roomDirectory, { recursive: true, force: true });
        }
        throw error;
      }
    },
  );
}

export async function joinRoom(
  input: JoinRoomInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ action: "joined" | "updated" | "unchanged"; member: RoomMemberView; commit?: string }> {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room join",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      if (roomResult.room.status !== "active") {
        throw new ServiceError(
          "ROOM_ARCHIVED",
          `cannot join archived room: ${roomResult.room.id}`,
        );
      }
      const memberPath = resolve(
        registration.path,
        "rooms",
        roomResult.room.id,
        "members",
        `${identity.memberId}.json`,
      );
      const existing = await readRoomMember(memberPath);
      const role = input.role ?? identity.role;
      const responsibility = input.responsibility ?? identity.responsibility;
      if (
        existing?.status === "active" &&
        existing.role === role &&
        existing.responsibility === responsibility
      ) {
        return { action: "unchanged", member: existing };
      }
      const timestamp = currentUtcTimestamp(input.now);
      const member = roomMemberDocument(
        roomResult.room.id,
        identity,
        role,
        responsibility,
        "active",
        existing?.joinedAt ?? timestamp,
        timestamp,
      );
      const commit = await commitMutableDocument(
        registration.path,
        memberPath,
        "room-member",
        member,
        `Join room ${roomResult.room.slug}`,
      );
      return {
        action: existing ? "updated" : "joined",
        member,
        commit,
      };
    },
  );
}

export async function leaveRoom(
  input: Omit<JoinRoomInput, "role" | "responsibility">,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ action: "left" | "unchanged"; member: RoomMemberView; commit?: string }> {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    "room leave",
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      const memberPath = resolve(
        registration.path,
        "rooms",
        roomResult.room.id,
        "members",
        `${identity.memberId}.json`,
      );
      const existing = await readRoomMember(memberPath);
      if (!existing) {
        throw new ServiceError(
          "ROOM_MEMBERSHIP_REQUIRED",
          `identity is not a room member: ${identity.memberId}`,
        );
      }
      if (existing.status === "left") {
        return { action: "unchanged", member: existing };
      }
      const member = {
        ...existing,
        status: "left" as const,
        updatedAt: currentUtcTimestamp(input.now),
      };
      const commit = await commitMutableDocument(
        registration.path,
        memberPath,
        "room-member",
        member,
        `Leave room ${roomResult.room.slug}`,
      );
      return { action: "left", member, commit };
    },
  );
}

export async function requireActiveRoomMember(
  registration: LocalForumRegistration,
  roomId: string,
  identity: LocalIdentity,
): Promise<RoomMemberView> {
  const memberPath = resolve(
    registration.path,
    "rooms",
    roomId,
    "members",
    `${identity.memberId}.json`,
  );
  const member = await readRoomMember(memberPath);
  if (!member || member.status !== "active") {
    throw new ServiceError(
      "ROOM_MEMBERSHIP_REQUIRED",
      `identity is not an active room member: ${identity.memberId}`,
    );
  }
  return member;
}

export async function createRoomEvent(
  input: RoomEventInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ eventId: string; room: RoomView; commit: string }> {
  return withForumWrite(
    input.forumAlias,
    input.identityId,
    paths,
    input.type,
    async (registration, identity) => {
      const roomResult = await showRoom(input.forumAlias, input.room, paths);
      if (input.type === "room-deprecated" && typeof input.data.replacementRoomId === "string") {
        const replacement = await showRoom(input.forumAlias, input.data.replacementRoomId, paths);
        if (replacement.room.id === roomResult.room.id) {
          throw new ServiceError(
            "ROOM_REPLACEMENT_INVALID",
            "replacementRoomId cannot be the deprecated room itself",
          );
        }
      }
      await requireActiveRoomMember(registration, roomResult.room.id, identity);
      const eventId = input.eventId ?? createEntityId("event");
      const timestamp = currentUtcTimestamp(input.now);
      const event = {
        schemaVersion: "1.0",
        id: eventId,
        scope: "room",
        targetId: roomResult.room.id,
        type: input.type,
        actorId: identity.memberId,
        createdAt: timestamp,
        reason: input.reason,
        data: input.data,
      };
      const currentState: RoomState = {
        scope: "room",
        id: roomResult.room.id,
        title: roomResult.room.title,
        description: roomResult.room.description,
        status: roomResult.room.status,
        ...(roomResult.room.deprecation
          ? { deprecation: { ...(roomResult.room.deprecation.replacementRoomId ? { replacementRoomId: roomResult.room.deprecation.replacementRoomId } : {}) } }
          : {}),
      };
      const nextState = applyLifecycleEvent(
        currentState,
        event as unknown as LifecycleEventInput,
      );
      const eventDirectory = resolve(
        registration.path,
        "rooms",
        roomResult.room.id,
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
          `${input.type} ${roomResult.room.slug}`,
        );
        return {
          eventId,
          room: {
            ...roomResult.room,
            title: nextState.title,
            description: nextState.description,
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
