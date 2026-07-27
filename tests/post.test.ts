import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli, type CliIo } from "../src/cli.js";
import { requireGit } from "../src/git/runner.js";
import { ServiceError } from "../src/services/errors.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom, leaveRoom } from "../src/services/room.js";
import {
  createPost,
  createThread,
  createThreadEvent,
  showThread,
} from "../src/services/thread.js";
import { StorageError } from "../src/storage/errors.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const mentionedMember = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const threadId = "thread_0194f6d2-8c10-7a31-9e42-123456789abe";
const firstMessageId = "msg_0194f6d2-8c10-7a31-9e42-123456789abf";
const postId = "msg_0194f6d2-8c10-7a31-9e42-123456789ad0";
const replyId = "msg_0194f6d2-8c10-7a31-9e42-123456789ad1";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setup(home: string) {
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
  const thread = await createThread(
    {
      forumAlias: "a-team",
      room: "checkout",
      title: "Order API contract",
      kind: "proposal",
      body: "Add a currency field.",
      threadId,
      messageId: firstMessageId,
      now: createdAt,
    },
    paths,
  );
  return { paths, forum, thread };
}

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

test("post create and reply append immutable typed messages with mentions and references", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-post-create-"));
  try {
    const { paths, forum } = await setup(home);
    const posted = await createPost(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "decision",
        body: "Use ISO 4217 currency codes.\n",
        broadcast: true,
        mentions: [mentionedMember],
        references: [
          { kind: "endpoint", value: "POST /api/orders" },
          { kind: "commit", value: "abc123" },
        ],
        messageId: postId,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    assert.equal(posted.message.replyTo, null);
    assert.equal(posted.message.type, "decision");
    assert.equal(posted.message.audience, "broadcast");
    assert.deepEqual(posted.message.mentions, [mentionedMember]);
    assert.equal(posted.thread.messageCount, 2);

    const replied = await createPost(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "acknowledgement",
        body: "Acknowledged; the backend implementation is ready.",
        replyTo: postId,
        references: [{ kind: "path", value: "src/orders.ts" }],
        messageId: replyId,
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    assert.equal(replied.message.replyTo, postId);
    assert.equal(replied.thread.messageCount, 3);
    assert.equal(replied.thread.lastActivityAt, "2026-07-12T10:22:00.000Z");

    const shown = await showThread("a-team", "checkout", threadId, paths);
    assert.deepEqual(
      shown.messages.map((message) => message.id),
      [firstMessageId, postId, replyId],
    );
    assert.equal(shown.messages[1]?.audience, "broadcast");
    assert.equal(shown.messages[2]?.replyTo, postId);
    assert.equal(shown.warnings.length, 0);
    const metadata = JSON.parse(
      await readFile(
        resolve(
          forum.path,
          "rooms",
          roomId,
          "threads",
          threadId,
          "messages",
          replyId,
          "message.json",
        ),
        "utf8",
      ),
    );
    assert.equal(metadata.replyTo, postId);
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "5",
    );
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("post writers reject unknown types, invalid reply targets, duplicate mentions, and ID collisions", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-post-invalid-"));
  try {
    const { paths, forum } = await setup(home);
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "future-type",
          body: "Unknown type.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "MESSAGE_TYPE_INVALID",
    );
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "answer",
          body: "Target does not exist.",
          replyTo: "msg_0194f6d2-8c10-7a31-9e42-123456789aff",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "MESSAGE_NOT_FOUND",
    );
    const duplicateId = "msg_0194f6d2-8c10-7a31-9e42-123456789ad2";
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "review",
          body: "Duplicate mention.",
          mentions: [mentionedMember, mentionedMember],
          messageId: duplicateId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "SCHEMA_VALIDATION_FAILED",
    );
    const firstPath = resolve(
      forum.path,
      "rooms",
      roomId,
      "threads",
      threadId,
      "messages",
      firstMessageId,
    );
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "discussion",
          body: "Message ID collision.",
          messageId: firstMessageId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "IMMUTABLE_PATH_EXISTS",
    );
    assert.equal(
      await readFile(resolve(firstPath, "body.md"), "utf8"),
      "Add a currency field.",
    );
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("closed Threads and left Room members cannot post", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-post-permission-"));
  try {
    const { paths } = await setup(home);
    await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "thread-closed",
        reason: "Discussion is complete.",
        data: {},
        now: createdAt,
      },
      paths,
    );
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "discussion",
          body: "Closed thread write.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "THREAD_CLOSED",
    );
    await createThreadEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "thread-reopened",
        reason: "More work is needed.",
        data: {},
        now: createdAt,
      },
      paths,
    );
    await leaveRoom(
      {
        forumAlias: "a-team",
        room: "checkout",
        now: createdAt,
      },
      paths,
    );
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "discussion",
          body: "Left member write.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "ROOM_MEMBERSHIP_REQUIRED",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("damaged historical messages do not block unrelated posts but damaged opening messages do", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-post-damage-"));
  try {
    const { paths, forum } = await setup(home);
    await createPost(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "status",
        body: "Historical status.",
        messageId: postId,
        now: createdAt,
      },
      paths,
    );
    const historicalBody = [
      "rooms",
      roomId,
      "threads",
      threadId,
      "messages",
      postId,
      "body.md",
    ].join("/");
    requireGit(forum.path, ["rm", "--", historicalBody]);
    requireGit(forum.path, ["commit", "-m", "Damage historical fixture"]);

    const posted = await createPost(
      {
        forumAlias: "a-team",
        room: "checkout",
        thread: threadId,
        type: "correction",
        body: "A new independent correction remains publishable.",
        messageId: replyId,
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    assert.equal(posted.message.id, replyId);
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "correction",
          body: "Cannot reply to a damaged target.",
          replyTo: postId,
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "MESSAGE_NOT_FOUND",
    );

    const openingBody = [
      "rooms",
      roomId,
      "threads",
      threadId,
      "messages",
      firstMessageId,
      "body.md",
    ].join("/");
    requireGit(forum.path, ["rm", "--", openingBody]);
    requireGit(forum.path, ["commit", "-m", "Damage opening fixture"]);
    await assert.rejects(
      createPost(
        {
          forumAlias: "a-team",
          room: "checkout",
          thread: threadId,
          type: "discussion",
          body: "Opening message damage blocks writes.",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "PROTOCOL_DATA_DAMAGED",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("post and Thread CLI default recipient-free messages to Room broadcasts", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-post-default-broadcast-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    await setup(home);
    const postIo = captureIo();
    assert.equal(await runCli(["--json", "post", "create", "--forum", "a-team", "--room", "checkout", "--thread", threadId, "--type", "status", "--body", "No recipient was selected."], postIo.io), 0);
    assert.equal(JSON.parse(postIo.stdout.join("")).data.message.audience, "broadcast");

    const threadIo = captureIo();
    assert.equal(await runCli(["--json", "thread", "create", "--forum", "a-team", "--room", "checkout", "--kind", "discussion", "--title", "Default broadcast", "--body", "Opening message."], threadIo.io), 0);
    assert.equal(JSON.parse(threadIo.stdout.join("")).data.firstMessage.audience, "broadcast");
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

test("post CLI parses repeated options and rejects malformed values before service access", async () => {
  const duplicate = captureIo();
  assert.equal(
    await runCli(
      [
        "post",
        "create",
        "--forum",
        "a-team",
        "--room",
        "checkout",
        "--thread",
        threadId,
        "--type",
        "review",
        "--body",
        "Review body",
        "--mention",
        memberId,
        "--mention",
        memberId,
        "--json",
      ],
      duplicate.io,
    ),
    2,
  );
  assert.equal(
    JSON.parse(duplicate.stdout.join("")).error.code,
    "INVALID_ARGUMENT",
  );

  const malformed = captureIo();
  assert.equal(
    await runCli(
      [
        "post",
        "reply",
        "--forum",
        "a-team",
        "--room",
        "checkout",
        "--thread",
        threadId,
        "--reply-to",
        firstMessageId,
        "--type",
        "answer",
        "--body",
        "Answer body",
        "--reference",
        "unknown=value",
        "--json",
      ],
      malformed.io,
    ),
    2,
  );
  assert.equal(
    JSON.parse(malformed.stdout.join("")).error.code,
    "INVALID_ARGUMENT",
  );
});
