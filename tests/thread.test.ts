import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli, type CliIo } from "../src/cli.js";
import { StateTransitionError } from "../src/domain/state-transitions.js";
import { requireGit } from "../src/git/runner.js";
import { ServiceError } from "../src/services/errors.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import {
  createRoom,
  createRoomEvent,
  joinRoom,
} from "../src/services/room.js";
import {
  createThread,
  createThreadEvent,
  listThreads,
  showThread,
} from "../src/services/thread.js";
import { StorageError } from "../src/storage/errors.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const threadId = "thread_0194f6d2-8c10-7a31-9e42-123456789abe";
const messageId = "msg_0194f6d2-8c10-7a31-9e42-123456789abf";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

function captureIo(): { io: CliIo; stdout: string[] } {
  const stdout: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: () => undefined,
    },
    stdout,
  };
}

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity(
    {
      memberId: memberA,
      displayName: "Backend A",
      role: "backend",
      responsibility: "Order service",
      now: createdAt,
    },
    paths,
  );
  const forum = await initLocalForum(
    {
      alias: "a-team",
      name: "A Team",
      description: "Engineering",
      forumId,
      now: createdAt,
    },
    paths,
  );
  await createRoom(
    {
      forumAlias: "a-team",
      slug: "checkout",
      title: "Checkout",
      description: "Checkout collaboration",
      roomId,
      now: createdAt,
    },
    paths,
  );
  return { paths, forum };
}

test("thread creation atomically includes a matching non-empty first message", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-thread-create-"));
  try {
    const { paths, forum } = await setup(home);
    const created = await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        title: "Add currency to the order API",
        kind: "proposal",
        body: "We should add `currency` to the order contract.\n",
        threadId,
        messageId,
        now: createdAt,
      },
      paths,
    );
    assert.equal(created.thread.kind, "proposal");
    assert.equal(created.firstMessage.type, created.thread.kind);
    assert.equal(created.firstMessage.replyTo, null);
    assert.equal(created.thread.messageCount, 1);
    const base = resolve(forum.path, "rooms", roomId, "threads", threadId);
    const metadata = JSON.parse(
      await readFile(resolve(base, "messages", messageId, "message.json"), "utf8"),
    );
    assert.equal(metadata.threadId, threadId);
    assert.equal(metadata.type, "proposal");
    assert.equal(
      await readFile(resolve(base, "messages", messageId, "body.md"), "utf8"),
      "We should add `currency` to the order contract.\n",
    );
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "3",
    );

    const listed = await listThreads("a-team", "checkout", paths);
    assert.equal(listed.warnings.length, 0);
    assert.deepEqual(listed.threads, [created.thread]);
    const shown = await showThread("a-team", "checkout", threadId, paths);
    assert.equal(shown.messages.length, 1);
    assert.equal(shown.messages[0]?.body.includes("currency"), true);

    await assert.rejects(
      createThread(
        {
          forumAlias: "a-team",
          room: "checkout",
          title: "Invalid kind",
          kind: "answer",
          body: "This cannot open a thread.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "THREAD_KIND_INVALID",
    );
    const emptyThreadId = "thread_0194f6d2-8c10-7a31-9e42-123456789ad0";
    await assert.rejects(
      createThread(
        {
          forumAlias: "a-team",
          room: "checkout",
          title: "Empty opening",
          kind: "discussion",
          body: "  \n",
          threadId: emptyThreadId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError && error.code === "INVALID_MESSAGE_BODY",
    );
    await assert.rejects(
      access(resolve(forum.path, "rooms", roomId, "threads", emptyThreadId)),
    );

    await assert.rejects(
      createThread(
        {
          forumAlias: "a-team",
          room: "checkout",
          title: "Thread ID collision",
          kind: "discussion",
          body: "Must not replace the original thread.",
          threadId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "IMMUTABLE_PATH_EXISTS",
    );
    assert.equal(
      JSON.parse(await readFile(resolve(base, "thread.json"), "utf8")).kind,
      "proposal",
    );
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("thread lists sort by last activity descending with an ID tie-breaker", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-thread-order-"));
  try {
    const { paths } = await setup(home);
    const firstId = "thread_0194f6d2-8c10-7a31-9e42-123456789ad0";
    const secondId = "thread_0194f6d2-8c10-7a31-9e42-123456789ad1";
    await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        title: "First",
        kind: "discussion",
        body: "First thread.",
        threadId: firstId,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        title: "Second",
        kind: "question",
        body: "Second thread.",
        threadId: secondId,
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    assert.deepEqual(
      (await listThreads("a-team", "checkout", paths)).threads.map(
        (thread) => thread.id,
      ),
      [secondId, firstId],
    );
    await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: firstId,
        type: "thread-renamed",
        reason: "New activity.",
        data: { title: "First updated" },
        now: new Date("2026-07-12T10:23:00.000Z"),
      },
      paths,
    );
    assert.deepEqual(
      (await listThreads("a-team", "checkout", paths)).threads.map(
        (thread) => thread.id,
      ),
      [firstId, secondId],
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("only active Room members can create threads and archived Rooms are read-only", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-thread-permission-"));
  try {
    const { paths } = await setup(home);
    await createLocalIdentity(
      {
        memberId: memberB,
        displayName: "Frontend B",
        role: "frontend",
        responsibility: "Checkout UI",
        setDefault: false,
        now: createdAt,
      },
      paths,
    );
    await publishIdentity("a-team", memberB, paths, createdAt);
    await assert.rejects(
      createThread(
        {
          forumAlias: "a-team",
          room: "checkout",
          identityId: memberB,
          title: "UI contract",
          kind: "question",
          body: "Which fields are required?",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "ROOM_MEMBERSHIP_REQUIRED",
    );
    await joinRoom(
      {
        forumAlias: "a-team",
        room: "checkout",
        identityId: memberB,
        now: createdAt,
      },
      paths,
    );
    const created = await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        identityId: memberB,
        title: "UI contract",
        kind: "question",
        body: "Which fields are required?",
        now: createdAt,
      },
      paths,
    );
    assert.equal(created.firstMessage.authorId, memberB);

    await createRoomEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        type: "room-archived",
        reason: "Feature work is paused.",
        data: {},
        now: createdAt,
      },
      paths,
    );
    assert.equal(
      (await showThread("a-team", "checkout", created.thread.id, paths)).thread.id,
      created.thread.id,
    );
    await assert.rejects(
      createThread(
        {
          forumAlias: "a-team",
          room: "checkout",
          identityId: memberB,
          title: "Archived write",
          kind: "discussion",
          body: "This must fail.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "ROOM_ARCHIVED",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("thread lifecycle events derive title and open/closed state without replacing history", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-thread-events-"));
  try {
    const { paths, forum } = await setup(home);
    await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        title: "Currency contract",
        kind: "proposal",
        body: "Add a currency field.",
        threadId,
        messageId,
        now: createdAt,
      },
      paths,
    );
    const renamed = await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "thread-renamed",
        reason: "Clarify the scope.",
        data: { title: "Order currency contract" },
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad1",
        now: new Date("2026-07-12T10:30:00.000Z"),
      },
      paths,
    );
    assert.equal(renamed.thread.title, "Order currency contract");
    const eventId = "evt_0194f6d2-8c10-7a31-9e42-123456789ad2";
    const closed = await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "thread-closed",
        reason: "The proposal was accepted.",
        data: {},
        eventId,
        now: new Date("2026-07-12T10:31:00.000Z"),
      },
      paths,
    );
    assert.equal(closed.thread.status, "closed");
    await assert.rejects(
      createThreadEvent(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "thread-closed",
          reason: "Duplicate close.",
          data: {},
        },
        paths,
      ),
      (error) =>
        error instanceof StateTransitionError &&
        error.code === "INVALID_STATE_TRANSITION",
    );
    await assert.rejects(
      createThreadEvent(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "thread-reopened",
          reason: "Event ID collision.",
          data: {},
          eventId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "IMMUTABLE_PATH_EXISTS",
    );
    assert.equal(
      (await showThread("a-team", "checkout", threadId, paths)).thread.status,
      "closed",
    );
    const reopened = await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "thread-reopened",
        reason: "A new concern needs discussion.",
        data: {},
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad3",
        now: new Date("2026-07-12T10:32:00.000Z"),
      },
      paths,
    );
    assert.equal(reopened.thread.status, "open");
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "6",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("damaged opening messages remain visible as warnings", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-thread-damage-"));
  try {
    const { paths, forum } = await setup(home);
    await createThread(
      {
        forumAlias: "a-team",
        room: "checkout",
        title: "Currency contract",
        kind: "proposal",
        body: "Add a currency field.",
        threadId,
        messageId,
        now: createdAt,
      },
      paths,
    );
    await rm(
      resolve(
        forum.path,
        "rooms",
        roomId,
        "threads",
        threadId,
        "messages",
        messageId,
        "body.md",
      ),
    );
    const shown = await showThread("a-team", "checkout", threadId, paths);
    assert.equal(shown.thread.id, threadId);
    assert.equal(shown.messages.length, 0);
    assert.equal(
      shown.warnings.some((warning) => warning.code === "FIRST_MESSAGE_MISSING"),
      true,
    );
    assert.equal(
      shown.warnings.some(
        (warning) => warning.code === "PROTOCOL_DATA_DAMAGED",
      ),
      true,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("thread CLI returns stable JSON errors for incomplete commands", async () => {
  const output = captureIo();
  const exitCode = await runCli(
    ["thread", "create", "--forum", "a-team", "--json"],
    output.io,
  );
  assert.equal(exitCode, 2);
  const result = JSON.parse(output.stdout.join(""));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_ARGUMENT");
});
