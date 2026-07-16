import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom } from "../src/services/room.js";
import { createPost, createThread, createThreadEvent } from "../src/services/thread.js";
import { getForumSnapshot } from "../src/services/timeline-cache.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity(
    { memberId, displayName: "A", role: "backend", responsibility: "API", now: createdAt },
    paths,
  );
  await initLocalForum(
    { alias: "team", name: "Team", description: "Cache", forumId, now: createdAt },
    paths,
  );
  await createRoom(
    {
      forumAlias: "team",
      slug: "alpha",
      title: "Alpha",
      description: "Alpha room",
      roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad1",
      now: createdAt,
    },
    paths,
  );
  await createRoom(
    {
      forumAlias: "team",
      slug: "beta",
      title: "Beta",
      description: "Beta room",
      roomId: "room_0194f6d2-8c10-7a31-9e42-123456789ad2",
      now: createdAt,
    },
    paths,
  );
  await createThread(
    {
      forumAlias: "team",
      room: "alpha",
      title: "Alpha thread",
      kind: "discussion",
      body: "Opening alpha.",
      threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789ae1",
      now: createdAt,
    },
    paths,
  );
  await createThread(
    {
      forumAlias: "team",
      room: "beta",
      title: "Beta thread",
      kind: "question",
      body: "Opening beta?",
      threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789ae2",
      now: createdAt,
    },
    paths,
  );
  return paths;
}

test("snapshot cache hits by HEAD and incrementally rebuilds affected Rooms", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-cache-incremental-"));
  try {
    const paths = await setup(home);
    const initial = await getForumSnapshot("team", paths);
    assert.equal(initial.cache, "rebuilt");
    assert.equal(initial.snapshot.rooms.length, 2);
    const initialHead = initial.snapshot.sourceHead;
    assert.equal((await getForumSnapshot("team", paths)).cache, "hit");

    const alphaThread = initial.snapshot.rooms.find((room) => room.room.slug === "alpha")!.threads[0]!.thread.id;
    await createPost(
      {
        forumAlias: "team",
        room: "alpha",
        thread: alphaThread,
        type: "status",
        body: "Alpha changed.",
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    const incremental = await getForumSnapshot("team", paths);
    assert.equal(incremental.cache, "incremental");
    const alpha = incremental.snapshot.rooms.find((room) => room.room.slug === "alpha")!;
    const beta = incremental.snapshot.rooms.find((room) => room.room.slug === "beta")!;
    assert.equal(alpha.sourceHead, incremental.snapshot.sourceHead);
    assert.equal(beta.sourceHead, initialHead, "unaffected Room snapshot should be preserved");
    assert.equal(alpha.threads[0]!.timeline.length, 2);
    assert.equal(incremental.snapshot.warnings.every((warning) => !warning.path.includes(home)), true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Thread Message and Event entries share one stable ascending timeline", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-cache-timeline-"));
  try {
    const paths = await setup(home);
    const initial = await getForumSnapshot("team", paths);
    const thread = initial.snapshot.rooms.find((room) => room.room.slug === "alpha")!.threads[0]!.thread.id;
    await createThreadEvent(
      {
        forumAlias: "team",
        room: "alpha",
        thread,
        type: "thread-renamed",
        reason: "Clarify timeline.",
        data: { title: "Alpha timeline" },
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    await createPost(
      {
        forumAlias: "team",
        room: "alpha",
        thread,
        type: "status",
        body: "After rename.",
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    const timeline = (await getForumSnapshot("team", paths)).snapshot.rooms
      .find((room) => room.room.slug === "alpha")!.threads[0]!.timeline;
    assert.deepEqual(timeline.map((item) => item.kind), ["message", "event", "message"]);
    assert.equal(timeline[1]?.type, "thread-renamed");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
