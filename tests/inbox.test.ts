import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { getInbox, showInboxEntry } from "../src/services/inbox.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import { createRoom, joinRoom, leaveRoom } from "../src/services/room.js";
import { createPost, createThread, createThreadEvent } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";
import { setThreadWatch } from "../src/services/thread-watch.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const threadId = "thread_0194f6d2-8c10-7a31-9e42-123456789abe";
const discoveryThreadId = "thread_0194f6d2-8c10-7a31-9e42-123456789abf";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity(
    { memberId: memberA, displayName: "A", role: "backend", responsibility: "API", now: createdAt },
    paths,
  );
  await createLocalIdentity(
    { memberId: memberB, displayName: "B", role: "frontend", responsibility: "UI", setDefault: false, now: createdAt },
    paths,
  );
  await initLocalForum(
    { alias: "team", name: "Team", description: "Inbox", forumId, now: createdAt },
    paths,
  );
  await publishIdentity("team", memberB, paths, createdAt);
  await createRoom(
    { forumAlias: "team", slug: "checkout", title: "Checkout", description: "Work", roomId, now: createdAt },
    paths,
  );
  await joinRoom(
    { forumAlias: "team", room: "checkout", identityId: memberB, now: createdAt },
    paths,
  );
  return paths;
}

test("Inbox returns relevant unread entries newest-first and marks pages explicitly", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-page-"));
  try {
    const paths = await setup(home);
    await createThread(
      {
        forumAlias: "team",
        room: "checkout",
        identityId: memberB,
        title: "API question",
        kind: "question",
        body: "Which currency format should we use?",
        threadId,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    await createPost(
      {
        forumAlias: "team",
        room: "checkout",
        thread: threadId,
        identityId: memberB,
        type: "status",
        body: "Frontend implementation has started.",
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    const first = await getInbox({ forumAlias: "team", limit: 1 }, paths);
    assert.equal(first.totalUnread, 2);
    assert.equal(first.hasMore, true);
    assert.equal(first.entries[0]?.summary, "Frontend implementation has started.");
    assert.equal(first.markedRead, 0);
    const short = await getInbox({ forumAlias: "team", limit: 1, summaryChars: 8 }, paths);
    assert.equal(short.entries[0]?.summaryTruncated, true);
    assert.equal(short.entries[0]?.summary, "Front...");
    const shown = await showInboxEntry({ forumAlias: "team", id: first.entries[0]?.id ?? "" }, paths);
    assert.equal(shown.content.body, "Frontend implementation has started.");
    assert.notEqual(shown.cache, "fallback");

    const marked = await getInbox(
      { forumAlias: "team", limit: 1, markRead: true },
      paths,
    );
    assert.equal(marked.markedRead, 1);
    const remaining = await getInbox({ forumAlias: "team" }, paths);
    assert.equal(remaining.totalUnread, 1);
    assert.equal(remaining.entries[0]?.type, "question");
    const all = await getInbox({ forumAlias: "team", markAllRead: true }, paths);
    assert.equal(all.markedRead, 1);
    assert.equal((await getInbox({ forumAlias: "team" }, paths)).totalUnread, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox promotes replies and watched closed Threads without hiding discovery", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-relevance-"));
  try {
    const paths = await setup(home);
    await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Watched", kind: "discussion", body: "Opening.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    await setThreadWatch({ forumAlias: "team", threadId, watch: true }, paths);
    const mine = await createPost({ forumAlias: "team", room: "checkout", thread: threadId, type: "status", body: "My tracked update.", now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    await createPost({ forumAlias: "team", room: "checkout", thread: threadId, identityId: memberB, replyTo: mine.message.id, type: "answer", body: "Reply to A.", now: new Date("2026-07-12T10:23:00.000Z") }, paths);
    await createThreadEvent({ forumAlias: "team", room: "checkout", thread: threadId, identityId: memberB, type: "thread-closed", reason: "Completed.", data: {}, now: new Date("2026-07-12T10:24:00.000Z") }, paths);
    await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Unrelated", kind: "discussion", body: "Discovery item.", threadId: discoveryThreadId, now: new Date("2026-07-12T10:25:00.000Z") }, paths);
    const inbox = await getInbox({ forumAlias: "team", limit: 3 }, paths);
    assert.equal(inbox.entries.some((entry) => entry.summary === "Reply to A." && entry.relevance === "direct"), true);
    assert.equal(inbox.entries.some((entry) => entry.type === "thread-closed" && entry.relevance === "watched"), true);
    assert.equal(inbox.relevanceCounts.discovery > 0, true);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Inbox includes Room/Thread events, excludes own activity, and stops while left", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-membership-"));
  try {
    const paths = await setup(home);
    await createThread(
      {
        forumAlias: "team",
        room: "checkout",
        identityId: memberB,
        title: "Decision",
        kind: "discussion",
        body: "Discuss the contract.",
        threadId,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    await createThreadEvent(
      {
        forumAlias: "team",
        room: "checkout",
        thread: threadId,
        identityId: memberB,
        type: "thread-renamed",
        reason: "Clarify topic.",
        data: { title: "Contract decision" },
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    await createPost(
      {
        forumAlias: "team",
        room: "checkout",
        thread: threadId,
        identityId: memberA,
        type: "status",
        body: "My own update.",
        now: new Date("2026-07-12T10:23:00.000Z"),
      },
      paths,
    );
    const inbox = await getInbox({ forumAlias: "team" }, paths);
    assert.equal(inbox.entries.some((entry) => entry.kind === "event"), true);
    assert.equal(inbox.entries.some((entry) => entry.summary === "My own update."), false);
    await getInbox({ forumAlias: "team", markAllRead: true }, paths);

    await leaveRoom({ forumAlias: "team", room: "checkout", now: new Date("2026-07-12T10:24:00.000Z") }, paths);
    await createPost(
      {
        forumAlias: "team",
        room: "checkout",
        thread: threadId,
        identityId: memberB,
        type: "status",
        body: "Update while A is away.",
        now: new Date("2026-07-12T10:25:00.000Z"),
      },
      paths,
    );
    assert.equal((await getInbox({ forumAlias: "team" }, paths)).totalUnread, 0);
    await joinRoom(
      { forumAlias: "team", room: "checkout", now: new Date("2026-07-12T10:26:00.000Z") },
      paths,
    );
    await createPost(
      {
        forumAlias: "team",
        room: "checkout",
        thread: threadId,
        identityId: memberB,
        type: "status",
        body: "Update after A returned.",
        now: new Date("2026-07-12T10:27:00.000Z"),
      },
      paths,
    );
    const returned = await getInbox({ forumAlias: "team" }, paths);
    assert.deepEqual(returned.entries.map((entry) => entry.summary), ["Update after A returned."]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
