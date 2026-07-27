import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { requireGit, runGit } from "../src/git/runner.js";
import {
  closeConflict,
  listConflicts,
  prepareConflictReissue,
} from "../src/services/conflicts.js";
import { ServiceError } from "../src/services/errors.js";
import { addRemoteForum, publishLocalForum } from "../src/services/forum-remote.js";
import { refreshForumFromRemote, syncForum } from "../src/services/forum-sync.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom, createRoomEvent, listRooms } from "../src/services/room.js";
import { createThread } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function createIdentity(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity(
    {
      memberId,
      displayName: "Backend A",
      role: "backend",
      responsibility: "Order service",
      now: createdAt,
    },
    paths,
  );
  return paths;
}

async function setupSharedForum(root: string) {
  const sourcePaths = await createIdentity(resolve(root, "source-home"));
  const source = await initLocalForum(
    {
      alias: "source",
      name: "Shared Forum",
      description: "Sync tests",
      forumId,
      dataBranch: "forum-data",
      now: createdAt,
    },
    sourcePaths,
  );
  const remote = resolve(root, "forum.git");
  requireGit(root, ["init", "--bare", "--initial-branch=forum-data", remote]);
  await publishLocalForum({ forumAlias: "source", remote }, sourcePaths);
  requireGit(remote, ["symbolic-ref", "HEAD", "refs/heads/forum-data"]);
  return { sourcePaths, source, remote };
}

async function addClone(root: string, name: string, remote: string) {
  const home = resolve(root, `${name}-home`);
  const paths = await createIdentity(home);
  const forum = await addRemoteForum(
    { alias: name, remote, now: createdAt },
    paths,
  );
  requireGit(forum.path, ["config", "user.name", `Sync ${name}`]);
  requireGit(forum.path, ["config", "user.email", `${name}@example.invalid`]);
  return { paths, forum };
}

test("forum sync pulls remote commits and pushes local commits", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-basic-"));
  try {
    const shared = await setupSharedForum(root);
    const target = await addClone(root, "target", shared.remote);
    await createRoom(
      {
        forumAlias: "source",
        slug: "source-room",
        title: "Source Room",
        description: "Created in source",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad1",
        now: createdAt,
      },
      shared.sourcePaths,
    );
    assert.equal((await syncForum("source", shared.sourcePaths)).outcome, "pushed");
    const updated = await syncForum("target", target.paths);
    assert.equal(updated.outcome, "updated");
    assert.equal((await listRooms("target", target.paths)).rooms.length, 1);

    await createRoom(
      {
        forumAlias: "target",
        slug: "target-room",
        title: "Target Room",
        description: "Created in target",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad2",
        now: createdAt,
      },
      target.paths,
    );
    assert.equal((await syncForum("target", target.paths)).outcome, "pushed");
    assert.equal(
      (await syncForum("source", shared.sourcePaths)).outcome,
      "updated",
    );
    assert.equal((await listRooms("source", shared.sourcePaths)).rooms.length, 2);
    assert.equal((await syncForum("source", shared.sourcePaths)).outcome, "up-to-date");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("remote invalid Message metadata is isolated without blocking sync or later valid collaboration", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-remote-schema-"));
  try {
    const shared = await setupSharedForum(root);
    const target = await addClone(root, "target", shared.remote);
    const room = await createRoom({ forumAlias: "source", slug: "protocol", title: "Protocol", description: "Remote preflight", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad9", now: createdAt }, shared.sourcePaths);
    await syncForum("source", shared.sourcePaths);
    const thread = await createThread({ forumAlias: "source", room: room.room.id, title: "Schema", kind: "discussion", body: "Valid body", threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789ad9", messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789ad9", now: createdAt }, shared.sourcePaths);
    await syncForum("source", shared.sourcePaths);
    const metadataPath = resolve(shared.source.path, "rooms", room.room.id, "threads", thread.thread.id, "messages", thread.firstMessage.id, "message.json");
    const invalid = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
    invalid.schemaVersion = 9;
    invalid.createdAt = "not-a-timestamp";
    await writeFile(metadataPath, `${JSON.stringify(invalid, null, 2)}\n`);
    requireGit(shared.source.path, ["add", "--", metadataPath]);
    requireGit(shared.source.path, ["commit", "-m", "Inject invalid historical message for preflight test"]);
    requireGit(shared.source.path, ["push", "origin", "forum-data"]);

    const integrated = await syncForum("target", target.paths);
    assert.equal(integrated.outcome, "updated");
    assert.ok(integrated.warnings.some((warning) => warning.code === "REMOTE_MESSAGE_SCHEMA_INVALID"));
    assert.ok(integrated.warnings.some((warning) => warning.code === "REMOTE_IMMUTABLE_HISTORY_MODIFIED"));
    assert.equal(integrated.warnings.every((warning) => !warning.path?.includes(target.forum.path)), true, "sync warnings must not expose local clone paths");
    assert.deepEqual(await listConflicts("target", target.paths), { conflicts: [] });

    await createRoom({ forumAlias: "target", slug: "still-works", title: "Still works", description: "A valid Room after an isolated bad message.", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ada", now: new Date("2026-07-12T10:21:00.000Z") }, target.paths);
    assert.equal((await syncForum("target", target.paths)).outcome, "pushed");
    assert.equal((await syncForum("source", shared.sourcePaths)).outcome, "updated");
    assert.ok((await listRooms("source", shared.sourcePaths)).rooms.some((item) => item.slug === "still-works"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid remote Forum roots still block sync safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-invalid-root-"));
  try {
    const shared = await setupSharedForum(root);
    const target = await addClone(root, "target", shared.remote);
    const protocolPath = resolve(shared.source.path, ".forum", "protocol.json");
    const invalid = JSON.parse(await readFile(protocolPath, "utf8")) as Record<string, unknown>;
    invalid.dataBranch = "different-branch";
    await writeFile(protocolPath, `${JSON.stringify(invalid, null, 2)}\n`);
    requireGit(shared.source.path, ["add", "--", protocolPath]);
    requireGit(shared.source.path, ["commit", "-m", "Inject invalid Forum root for preflight test"]);
    requireGit(shared.source.path, ["push", "origin", "forum-data"]);
    const originalHead = requireGit(target.forum.path, ["rev-parse", "HEAD"]).stdout.trim();
    await assert.rejects(syncForum("target", target.paths), (error) => error instanceof ServiceError && error.code === "REMOTE_PROTOCOL_INVALID");
    assert.equal(requireGit(target.forum.path, ["rev-parse", "HEAD"]).stdout.trim(), originalHead);
    assert.deepEqual(await listConflicts("target", target.paths), { conflicts: [] });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Viewer refresh never pushes or rebases local commits", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-refresh-safe-"));
  try {
    const shared = await setupSharedForum(root);
    const target = await addClone(root, "target", shared.remote);
    await createRoom(
      {
        forumAlias: "target",
        slug: "local-room",
        title: "Local Room",
        description: "Must not be pushed by Viewer",
        now: createdAt,
      },
      target.paths,
    );
    const before = requireGit(target.forum.path, ["rev-parse", "HEAD"]).stdout.trim();
    const refreshed = await refreshForumFromRemote("target", target.paths);
    assert.equal(refreshed.outcome, "skipped-local-commits");
    assert.equal(refreshed.finalHead, before);
    assert.equal(requireGit(shared.remote, ["rev-parse", "forum-data"]).stdout.trim() === before, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent unique commits converge through non-fast-forward retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-race-"));
  try {
    const shared = await setupSharedForum(root);
    const first = await addClone(root, "first", shared.remote);
    const second = await addClone(root, "second", shared.remote);
    await createRoom(
      {
        forumAlias: "first",
        slug: "first-room",
        title: "First Room",
        description: "First concurrent room",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad3",
        now: createdAt,
      },
      first.paths,
    );
    await createRoom(
      {
        forumAlias: "second",
        slug: "second-room",
        title: "Second Room",
        description: "Second concurrent room",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad4",
        now: createdAt,
      },
      second.paths,
    );

    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolveBarrier) => {
      release = resolveBarrier;
    });
    const beforePush = async (attempt: number) => {
      if (attempt !== 1) return;
      arrivals += 1;
      if (arrivals === 2) release();
      await barrier;
    };
    const [firstResult, secondResult] = await Promise.all([
      syncForum("first", first.paths, {
        beforePush,
        delay: async () => undefined,
        random: () => 0,
      }),
      syncForum("second", second.paths, {
        beforePush,
        delay: async () => undefined,
        random: () => 0,
      }),
    ]);
    assert.equal(
      firstResult.retries + secondResult.retries,
      1,
      "exactly one writer should retry after the push race",
    );
    await syncForum("source", shared.sourcePaths);
    assert.deepEqual(
      (await listRooms("source", shared.sourcePaths)).rooms.map((room) => room.slug),
      ["first-room", "second-room"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("semantic validation blocks concurrent duplicate Room slugs", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-slug-"));
  try {
    const shared = await setupSharedForum(root);
    const first = await addClone(root, "first", shared.remote);
    const second = await addClone(root, "second", shared.remote);
    await createRoom(
      {
        forumAlias: "first",
        slug: "duplicate",
        title: "First Duplicate",
        description: "First",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ae1",
        now: createdAt,
      },
      first.paths,
    );
    await createRoom(
      {
        forumAlias: "second",
        slug: "duplicate",
        title: "Second Duplicate",
        description: "Second",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ae2",
        now: createdAt,
      },
      second.paths,
    );
    await syncForum("first", first.paths);
    const originalHead = requireGit(second.forum.path, ["rev-parse", "HEAD"]).stdout.trim();
    await assert.rejects(
      syncForum("second", second.paths),
      (error) =>
        error instanceof ServiceError && error.code === "SEMANTIC_CONFLICT",
    );
    assert.equal(
      requireGit(second.forum.path, ["rev-parse", "HEAD"]).stdout.trim(),
      originalHead,
    );
    await syncForum("source", shared.sourcePaths);
    assert.deepEqual(
      (await listRooms("source", shared.sourcePaths)).rooms.map((room) => room.slug),
      ["duplicate"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("semantic validation blocks concurrent field events", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-event-"));
  try {
    const shared = await setupSharedForum(root);
    await createRoom(
      {
        forumAlias: "source",
        slug: "shared-room",
        title: "Shared Room",
        description: "Shared",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ae3",
        now: createdAt,
      },
      shared.sourcePaths,
    );
    await syncForum("source", shared.sourcePaths);
    const first = await addClone(root, "first", shared.remote);
    const second = await addClone(root, "second", shared.remote);
    await createRoomEvent(
      {
        forumAlias: "first",
        room: "shared-room",
        type: "room-renamed",
        reason: "First rename.",
        data: { title: "First Name" },
        now: createdAt,
      },
      first.paths,
    );
    await createRoomEvent(
      {
        forumAlias: "second",
        room: "shared-room",
        type: "room-renamed",
        reason: "Second rename.",
        data: { title: "Second Name" },
        now: createdAt,
      },
      second.paths,
    );
    await syncForum("first", first.paths);
    await assert.rejects(
      syncForum("second", second.paths),
      (error) =>
        error instanceof ServiceError && error.code === "SEMANTIC_CONFLICT",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("immutable history edits never reach the remote", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-immutable-"));
  try {
    const shared = await setupSharedForum(root);
    const profile = resolve(shared.source.path, ".forum", "forum.json");
    const original = await readFile(profile, "utf8");
    await writeFile(profile, original.replace("Shared Forum", "Tampered Forum"), "utf8");
    requireGit(shared.source.path, ["add", ".forum/forum.json"]);
    requireGit(shared.source.path, ["commit", "-m", "Tamper immutable forum"]);
    await assert.rejects(
      syncForum("source", shared.sourcePaths),
      (error) =>
        error instanceof ServiceError &&
        error.code === "IMMUTABLE_HISTORY_MODIFIED",
    );
    const remoteForum = requireGit(shared.source.path, [
      "show",
      "origin/forum-data:.forum/forum.json",
    ]).stdout;
    assert.equal(remoteForum.includes("Shared Forum"), true);
    assert.equal(remoteForum.includes("Tampered Forum"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rebase conflicts abort and preserve the original local commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-sync-conflict-"));
  try {
    const shared = await setupSharedForum(root);
    const first = await addClone(root, "first", shared.remote);
    const second = await addClone(root, "second", shared.remote);
    const relativeProfile = `members/${memberId}/profile.json`;
    const firstProfilePath = resolve(first.forum.path, relativeProfile);
    const secondProfilePath = resolve(second.forum.path, relativeProfile);
    const firstProfile = JSON.parse(await readFile(firstProfilePath, "utf8"));
    const secondProfile = JSON.parse(await readFile(secondProfilePath, "utf8"));
    await writeFile(
      firstProfilePath,
      `${JSON.stringify({ ...firstProfile, responsibility: "First update" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      secondProfilePath,
      `${JSON.stringify({ ...secondProfile, responsibility: "Second update" }, null, 2)}\n`,
      "utf8",
    );
    requireGit(first.forum.path, ["add", relativeProfile]);
    requireGit(first.forum.path, ["commit", "-m", "First profile update"]);
    requireGit(second.forum.path, ["add", relativeProfile]);
    requireGit(second.forum.path, ["commit", "-m", "Second profile update"]);
    const originalHead = requireGit(second.forum.path, ["rev-parse", "HEAD"]).stdout.trim();
    await syncForum("first", first.paths);
    await assert.rejects(
      syncForum("second", second.paths),
      (error) =>
        error instanceof ServiceError && error.code === "SYNC_REBASE_CONFLICT",
    );
    assert.equal(
      requireGit(second.forum.path, ["rev-parse", "HEAD"]).stdout.trim(),
      originalHead,
    );
    assert.equal(requireGit(second.forum.path, ["status", "--porcelain"]).stdout, "");
    const journals = await listConflicts("second", second.paths);
    assert.equal(journals.conflicts.length, 1);
    const journal = journals.conflicts[0]!;
    assert.equal(journal.originalHead, originalHead);
    assert.equal(journal.conflicts.includes(relativeProfile), true);
    assert.equal(
      requireGit(second.forum.path, ["rev-parse", journal.recoveryRef]).stdout.trim(),
      originalHead,
    );
    const prepared = await prepareConflictReissue(
      "second",
      journal.operationId,
      second.paths,
    );
    assert.equal(prepared.status, "reissue-prepared");
    assert.equal(
      requireGit(second.forum.path, ["rev-parse", "HEAD"]).stdout.trim(),
      journal.remoteHead,
    );
    await closeConflict("second", journal.operationId, second.paths);
    assert.equal((await listConflicts("second", second.paths)).conflicts.length, 0);
    assert.notEqual(
      runGit(second.forum.path, ["rev-parse", journal.recoveryRef]).status,
      0,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
