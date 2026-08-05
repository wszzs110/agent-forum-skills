import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli } from "../src/cli.js";
import { getInbox, markInboxEntriesRead, showInboxEntry } from "../src/services/inbox.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import { createRoom, joinRoom, leaveRoom } from "../src/services/room.js";
import { createPost, createThread, createThreadEvent } from "../src/services/thread.js";
import { createAgentForumPaths, forumLockPath } from "../src/storage/paths.js";
import { setThreadWatch } from "../src/services/thread-watch.js";
import { acquireForumLock } from "../src/storage/lock.js";
import { ServiceError } from "../src/services/errors.js";
import { refreshForRead } from "../src/services/read-freshness.js";

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
    const first = await getInbox({ forumAlias: "team", all: true, limit: 1 }, paths);
    assert.equal(first.totalUnread, 2);
    assert.equal(first.hasMore, true);
    assert.equal(first.entries[0]?.summary, "Frontend implementation has started.");
    assert.equal(first.markedRead, 0);
    const short = await getInbox({ forumAlias: "team", all: true, limit: 1, summaryChars: 8 }, paths);
    assert.equal(short.entries[0]?.summaryTruncated, true);
    assert.equal(short.entries[0]?.summary, "Front...");
    const shown = await showInboxEntry({ forumAlias: "team", id: first.entries[0]?.id ?? "" }, paths);
    assert.equal(shown.content.body, "Frontend implementation has started.");
    assert.notEqual(shown.cache, "fallback");

    const marked = await getInbox(
      { forumAlias: "team", all: true, limit: 1, markRead: true },
      paths,
    );
    assert.equal(marked.markedRead, 1);
    const remaining = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.equal(remaining.totalUnread, 1);
    assert.equal(remaining.entries[0]?.type, "question");
    const precise = await markInboxEntriesRead({ forumAlias: "team", ids: [remaining.entries[0]!.id] }, paths);
    assert.equal(precise.markedRead, 1);
    assert.equal(precise.alreadyRead, 0);
    const repeated = await markInboxEntriesRead({ forumAlias: "team", ids: [remaining.entries[0]!.id] }, paths);
    assert.equal(repeated.markedRead, 0);
    assert.equal(repeated.alreadyRead, 1);
    await createPost({ forumAlias: "team", room: "checkout", thread: threadId, identityId: memberB, type: "status", body: "One more update.", now: new Date("2026-07-12T10:23:00.000Z") }, paths);
    const all = await getInbox({ forumAlias: "team", all: true, markAllRead: true }, paths);
    assert.equal(all.markedRead, 1);
    assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox CLI precisely marks selected IDs and exposes help", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-cli-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    const created = await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "CLI read", kind: "question", body: "Inspect this exact entry.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    const output: string[] = [];
    assert.equal(await runCli(["--json", "inbox", "mark-read", "--forum", "team", "--id", created.firstMessage.id, "--no-sync"], { stdout: (value) => output.push(value), stderr: () => undefined }), 0);
    const envelope = JSON.parse(output.join(""));
    assert.equal(envelope.command, "inbox.mark-read");
    assert.equal(envelope.data.markedRead, 1);
    assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 0);
    const help: string[] = [];
    assert.equal(await runCli(["inbox", "--help"], { stdout: (value) => help.push(value), stderr: () => undefined }), 0);
    assert.match(help.join(""), /inbox mark-read/u);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
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
    const inbox = await getInbox({ forumAlias: "team", all: true, limit: 3 }, paths);
    assert.equal(inbox.entries.some((entry) => entry.summary === "Reply to A." && entry.relevance === "direct"), true);
    assert.equal(inbox.entries.some((entry) => entry.type === "thread-closed" && entry.relevance === "watched"), true);
    assert.equal(inbox.relevanceCounts.discovery > 0, true);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Inbox show marks read by default and respects --no-mark-read", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-show-read-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    const created = await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Show read", kind: "question", body: "Inspect me.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    const id = created.firstMessage.id;
    // 默认 show 标记已读：一次 show 后 inbox 不再返回该条
    const out1: string[] = [];
    assert.equal(await runCli(["--json", "inbox", "show", "--forum", "team", "--id", id, "--no-sync"], { stdout: (value) => out1.push(value), stderr: () => undefined }), 0);
    const env1 = JSON.parse(out1.join(""));
    assert.equal(env1.ok, true);
    assert.equal(env1.command, "inbox.show");
    assert.equal(env1.data.markedRead, 1);
    assert.equal(env1.data.markWarning, null);
    assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 0);
    // --no-mark-read 不标记：show 后仍为未读
    await createPost({ forumAlias: "team", room: "checkout", thread: threadId, identityId: memberB, type: "status", body: "Second.", now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    const secondId = (await getInbox({ forumAlias: "team", all: true }, paths)).entries[0]!.id;
    const out2: string[] = [];
    assert.equal(await runCli(["--json", "inbox", "show", "--forum", "team", "--id", secondId, "--no-sync", "--no-mark-read"], { stdout: (value) => out2.push(value), stderr: () => undefined }), 0);
    const env2 = JSON.parse(out2.join(""));
    assert.equal(env2.ok, true);
    assert.equal(env2.data.markedRead, 0);
    assert.equal(env2.data.markWarning, null);
    assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 1);
    // --mark-read 与 --no-mark-read 互斥报错
    const out3: string[] = [];
    assert.equal(await runCli(["--json", "inbox", "show", "--forum", "team", "--id", secondId, "--no-sync", "--mark-read", "--no-mark-read"], { stdout: (value) => out3.push(value), stderr: () => undefined }), 2);
    const env3 = JSON.parse(out3.join(""));
    assert.equal(env3.ok, false);
    assert.equal(env3.error.code, "INVALID_ARGUMENT");
    assert.match(env3.error.message, /cannot be combined/u);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox mark-read degrades when the Forum lock is held by a reader refresh", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-lock-"));
  try {
    const paths = await setup(home);
    const created = await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Locked", kind: "question", body: "Mark me.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    const id = created.firstMessage.id;
    // 模拟 dashboard/viewer 的读刷新持有 forum 锁
    const heldLock = await acquireForumLock({ lockPath: forumLockPath(paths, forumId), command: "test reader refresh" });
    try {
      const freshness = await refreshForRead("team", {}, paths);
      assert.equal(freshness.error?.code, "LOCAL_LOCKED");
      const degraded = await markInboxEntriesRead({ forumAlias: "team", ids: [id], sync: true }, paths);
      assert.equal(degraded.markedRead, 1);
      assert.equal(degraded.sync, null);
      assert.notEqual(degraded.refreshWarning, null);
      assert.match(degraded.refreshWarning ?? "", /lock/u);
      assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 0);
    } finally {
      await heldLock.release();
    }
    // 锁释放后恢复正常：新消息 mark-read 无 refreshWarning
    await createPost({ forumAlias: "team", room: "checkout", thread: threadId, identityId: memberB, type: "status", body: "After lock.", now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    const secondId = (await getInbox({ forumAlias: "team", all: true }, paths)).entries[0]!.id;
    const normal = await markInboxEntriesRead({ forumAlias: "team", ids: [secondId], sync: true }, paths);
    assert.equal(normal.markedRead, 1);
    assert.equal(normal.refreshWarning, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox scopes by bound Room, explicit --room, or --all", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-scope-"));
  try {
    const paths = await setup(home);
    const otherRoomId = "room_0194f6d2-8c10-7a31-9e42-123456789ac0";
    await createRoom({ forumAlias: "team", slug: "other", title: "Other", description: "Second room", roomId: otherRoomId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    await joinRoom({ forumAlias: "team", room: "other", identityId: memberB, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Checkout msg", kind: "question", body: "In checkout.", threadId, now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    await createThread({ forumAlias: "team", room: "other", identityId: memberB, title: "Other msg", kind: "question", body: "In other.", threadId: discoveryThreadId, now: new Date("2026-07-12T10:23:00.000Z") }, paths);
    // 无绑定时要求显式 --room 或 --all
    await assert.rejects(
      () => getInbox({ forumAlias: "team" }, paths),
      (error: unknown) => error instanceof ServiceError && error.code === "INBOX_SCOPE_REQUIRED",
    );
    // --room 过滤：只返回指定房间
    const scoped = await getInbox({ forumAlias: "team", roomId: "checkout" }, paths);
    assert.equal(scoped.scope, "room");
    assert.equal(scoped.entries.length, 1);
    assert.equal(scoped.entries[0]?.roomSlug, "checkout");
    // --all：返回所有房间
    const allInbox = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.equal(allInbox.scope, "all");
    assert.equal(allInbox.entries.length, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox includes historical messages despite an incorrect sender clock", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-clock-skew-"));
  try {
    const paths = await setup(home);
    await createThread({
      forumAlias: "team",
      room: "checkout",
      identityId: memberB,
      title: "Clock skew",
      kind: "discussion",
      body: "Sent after the Room existed, but the sender clock is four days behind.",
      threadId: discoveryThreadId,
      now: new Date("2026-07-08T10:21:00.000Z"),
    }, paths);
    const inbox = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.equal(inbox.entries.some((entry) => entry.summary.includes("sender clock is four days behind")), true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
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
    const inbox = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.equal(inbox.entries.some((entry) => entry.kind === "event"), true);
    assert.equal(inbox.entries.some((entry) => entry.summary === "My own update."), false);
    await getInbox({ forumAlias: "team", all: true, markAllRead: true }, paths);

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
    assert.equal((await getInbox({ forumAlias: "team", all: true }, paths)).totalUnread, 0);
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
    const returned = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.deepEqual(returned.entries.map((entry) => entry.summary), ["Update after A returned.", "Update while A is away."]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox mark-read reports partial success with skipped IDs", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-partial-"));
  try {
    const paths = await setup(home);
    const created = await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Partial", kind: "question", body: "Mark me.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    // 默认 identity (memberA) 自己发一条：不在收件箱
    const own = await createPost({ forumAlias: "team", room: "checkout", thread: threadId, type: "status", body: "My own.", now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    const mixed = await markInboxEntriesRead({ forumAlias: "team", ids: [created.firstMessage.id, own.message.id], sync: false }, paths);
    assert.equal(mixed.markedRead, 1);
    assert.equal(mixed.results.find((item) => item.id === created.firstMessage.id)?.status, "read");
    assert.equal(mixed.results.find((item) => item.id === own.message.id)?.status, "skipped");
    // 重复标记：already-read
    const repeated = await markInboxEntriesRead({ forumAlias: "team", ids: [created.firstMessage.id], sync: false }, paths);
    assert.equal(repeated.results[0]?.status, "already-read");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox --full disables summary truncation", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-full-"));
  try {
    const paths = await setup(home);
    const longBody = "Start. " + "word ".repeat(400) + "End.";
    await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "Long", kind: "question", body: longBody, threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    const truncated = await getInbox({ forumAlias: "team", all: true }, paths);
    assert.equal(truncated.entries[0]?.summaryTruncated, true);
    const full = await getInbox({ forumAlias: "team", all: true, full: true }, paths);
    assert.equal(full.entries[0]?.summary.includes("End."), true);
    assert.equal(full.entries[0]?.summaryTruncated, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Inbox mark-read CLI reports skipped counts in human output", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-inbox-cli-partial-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    const created = await createThread({ forumAlias: "team", room: "checkout", identityId: memberB, title: "CLI partial", kind: "question", body: "Mark.", threadId, now: new Date("2026-07-12T10:21:00.000Z") }, paths);
    const own = await createPost({ forumAlias: "team", room: "checkout", thread: threadId, type: "status", body: "Mine.", now: new Date("2026-07-12T10:22:00.000Z") }, paths);
    const output: string[] = [];
    assert.equal(await runCli(["--json", "inbox", "mark-read", "--forum", "team", "--id", created.firstMessage.id, "--id", own.message.id, "--no-sync"], { stdout: (value) => output.push(value), stderr: () => undefined }), 0);
    const envelope = JSON.parse(output.join(""));
    assert.equal(envelope.command, "inbox.mark-read");
    assert.equal(envelope.data.markedRead, 1);
    assert.equal(envelope.data.results.filter((item: { status: string }) => item.status === "skipped").length, 1);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});
