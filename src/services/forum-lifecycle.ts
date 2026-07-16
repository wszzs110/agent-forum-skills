import type { Dirent } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { isEntityId, createEntityId } from "../domain/ids.js";
import {
  applyLifecycleEvent,
  isKnownLifecycleEventType,
  type ForumState,
  type LifecycleEventInput,
} from "../domain/state-transitions.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { commitPaths, runGit } from "../git/runner.js";
import { writeFileAtomic, writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { createImmutableEvent } from "../storage/protocol-store.js";
import { ServiceError } from "./errors.js";
import {
  openForum,
  protocolWarning,
  readJsonDocument,
  withForumWrite,
  type ProtocolWarning,
} from "./room.js";

export interface ForumView {
  forumId: string;
  name: string;
  description: string;
  status: "active" | "archived";
  createdBy: string;
  createdAt: string;
  lastActivityAt: string;
}

async function readForumView(
  forumAlias: string,
  paths: AgentForumPaths,
): Promise<{ forum: ForumView; warnings: ProtocolWarning[] }> {
  const { registration } = await openForum(forumAlias, paths);
  const basePath = resolve(registration.path, ".forum", "forum.json");
  const base = await readJsonDocument(basePath, "forum");
  if (base.forumId !== registration.forumId) {
    throw new ServiceError("FORUM_PROTOCOL_MISMATCH", "forum metadata ID does not match registration");
  }
  let state: ForumState = {
    scope: "forum",
    id: String(base.forumId),
    name: String(base.initialName),
    description: String(base.initialDescription),
    status: "active",
  };
  let lastActivityAt = String(base.createdAt);
  const warnings: ProtocolWarning[] = [];
  const eventsDirectory = resolve(registration.path, ".forum", "events");
  let entries: Dirent[] = [];
  try {
    entries = await readdir(eventsDirectory, { withFileTypes: true });
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const events: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const eventPath = resolve(eventsDirectory, entry.name, "event.json");
    if (!entry.isDirectory() || !isEntityId(entry.name, "event")) {
      warnings.push({ code: "INVALID_EVENT_PATH", path: resolve(eventsDirectory, entry.name), message: "forum event path is invalid" });
      continue;
    }
    try {
      const event = await readJsonDocument(eventPath, "event");
      if (event.id !== entry.name) {
        throw new StorageError("PATH_ID_MISMATCH", "event ID does not match path");
      }
      events.push(event);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  events.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id)));
  for (const event of events) {
    const eventPath = resolve(eventsDirectory, String(event.id), "event.json");
    if (!isKnownLifecycleEventType(String(event.type))) {
      warnings.push({ code: "UNKNOWN_EVENT_TYPE", path: eventPath, message: `unknown forum event type: ${String(event.type)}` });
      continue;
    }
    try {
      state = applyLifecycleEvent(state, {
        scope: "forum",
        targetId: String(event.targetId),
        type: String(event.type),
        data: event.data as Record<string, unknown>,
      });
      lastActivityAt = String(event.createdAt);
    } catch (error) {
      warnings.push(protocolWarning(eventPath, error));
    }
  }
  return {
    forum: {
      forumId: state.id,
      name: state.name,
      description: state.description,
      status: state.status,
      createdBy: String(base.createdBy),
      createdAt: String(base.createdAt),
      lastActivityAt,
    },
    warnings,
  };
}

export async function showForum(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
) {
  return readForumView(forumAlias, paths);
}

export async function createForumEvent(
  input: {
    forumAlias: string;
    type: "forum-renamed" | "forum-description-changed" | "forum-archived" | "forum-restored";
    reason: string;
    data: Record<string, unknown>;
    identityId?: string;
    eventId?: string;
    now?: Date;
  },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ eventId: string; forum: ForumView; commit: string }> {
  return withForumWrite(input.forumAlias, input.identityId, paths, input.type, async (registration, identity) => {
    const current = await readForumView(input.forumAlias, paths);
    const eventId = input.eventId ?? createEntityId("event");
    const timestamp = currentUtcTimestamp(input.now);
    const event = {
      schemaVersion: "1.0",
      id: eventId,
      scope: "forum",
      targetId: registration.forumId,
      type: input.type,
      actorId: identity.memberId,
      createdAt: timestamp,
      reason: input.reason,
      data: input.data,
    };
    const next = applyLifecycleEvent(
      {
        scope: "forum",
        id: current.forum.forumId,
        name: current.forum.name,
        description: current.forum.description,
        status: current.forum.status,
      } satisfies ForumState,
      event as unknown as LifecycleEventInput,
    );
    const directory = resolve(registration.path, ".forum", "events", eventId);
    let created = false;
    try {
      await createImmutableEvent(directory, event);
      created = true;
      const commit = commitPaths(registration.path, [directory], `${input.type} ${registration.forumId}`);
      return {
        eventId,
        forum: { ...current.forum, name: next.name, description: next.description, status: next.status, lastActivityAt: timestamp },
        commit,
      };
    } catch (error) {
      runGit(registration.path, ["reset", "--", directory]);
      if (created) await rm(directory, { recursive: true, force: true });
      throw error;
    }
  });
}

export async function leaveForum(
  forumAlias: string,
  identityId: string | undefined,
  paths: AgentForumPaths = createAgentForumPaths(),
  now = new Date(),
): Promise<{ memberId: string; commit: string }> {
  return withForumWrite(forumAlias, identityId, paths, "identity leave", async (registration, identity) => {
    const profilePath = resolve(registration.path, "members", identity.memberId, "profile.json");
    const previous = await readFile(profilePath, "utf8");
    const profile = await readJsonDocument(profilePath, "member-profile");
    const next = { ...profile, status: "left", updatedAt: currentUtcTimestamp(now) };
    try {
      await writeValidatedJsonAtomic(profilePath, "member-profile", next, { overwrite: true });
      const commit = commitPaths(registration.path, [profilePath], `Leave forum ${identity.memberId}`);
      return { memberId: identity.memberId, commit };
    } catch (error) {
      runGit(registration.path, ["reset", "--", profilePath]);
      await writeFileAtomic(profilePath, previous, { overwrite: true });
      throw error;
    }
  });
}
