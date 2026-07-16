import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  createLocalIdentity,
} from "../src/config/local-config.js";
import { runCli, type CliIo } from "../src/cli.js";
import { StateTransitionError } from "../src/domain/state-transitions.js";
import { requireGit } from "../src/git/runner.js";
import { ServiceError } from "../src/services/errors.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import {
  createRoom,
  createRoomEvent,
  joinRoom,
  leaveRoom,
  listRooms,
  showRoom,
} from "../src/services/room.js";
import { StorageError } from "../src/storage/errors.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout,
    stderr,
  };
}

async function setupForum(home: string) {
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
  return { paths, forum };
}

test("room creation auto-joins the creator and list/show derive the initial state", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-room-create-"));
  try {
    const { paths, forum } = await setupForum(home);
    const created = await createRoom(
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
    assert.equal(created.room.id, roomId);
    assert.equal(created.identityId, memberA);
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "2",
    );
    const member = JSON.parse(
      await readFile(
        resolve(
          forum.path,
          "rooms",
          roomId,
          "members",
          `${memberA}.json`,
        ),
        "utf8",
      ),
    );
    assert.equal(member.status, "active");
    assert.equal(member.role, "backend");

    const listed = await listRooms("a-team", paths);
    assert.equal(listed.warnings.length, 0);
    assert.deepEqual(listed.rooms, [created.room]);
    assert.equal((await showRoom("a-team", "checkout", paths)).room.id, roomId);
    assert.equal((await showRoom("a-team", roomId, paths)).room.slug, "checkout");
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");

    await assert.rejects(
      createRoom(
        {
          forumAlias: "a-team",
          slug: "checkout",
          title: "Duplicate",
          description: "Duplicate",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "ROOM_SLUG_EXISTS",
    );
    await assert.rejects(
      createRoom(
        {
          forumAlias: "a-team",
          slug: "other-room",
          title: "ID collision",
          description: "Must not replace the existing room",
          roomId,
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "IMMUTABLE_PATH_EXISTS",
    );
    assert.equal(
      JSON.parse(
        await readFile(resolve(forum.path, "rooms", roomId, "room.json"), "utf8"),
      ).slug,
      "checkout",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("forum members can self-join, leave, read, and rejoin with the original joinedAt", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-room-membership-"));
  try {
    const { paths, forum } = await setupForum(home);
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

    await assert.rejects(
      joinRoom(
        {
          forumAlias: "a-team",
          room: "checkout",
          identityId: memberB,
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "FORUM_MEMBERSHIP_REQUIRED",
    );
    await publishIdentity("a-team", memberB, paths, createdAt);

    const joined = await joinRoom(
      {
        forumAlias: "a-team",
        room: "checkout",
        identityId: memberB,
        responsibility: "Checkout UI integration",
        now: new Date("2026-07-12T10:30:00.000Z"),
      },
      paths,
    );
    assert.equal(joined.action, "joined");
    assert.equal(joined.member.status, "active");
    assert.equal(joined.member.responsibility, "Checkout UI integration");
    const originalJoinedAt = joined.member.joinedAt;

    const left = await leaveRoom(
      {
        forumAlias: "a-team",
        room: roomId,
        identityId: memberB,
        now: new Date("2026-07-12T10:40:00.000Z"),
      },
      paths,
    );
    assert.equal(left.action, "left");
    assert.equal(left.member.status, "left");

    assert.equal(
      (await showRoom("a-team", "checkout", paths)).room.title,
      "Checkout",
      "left members still retain read access through the forum repository",
    );
    await assert.rejects(
      createRoomEvent(
        {
          forumAlias: "a-team",
          room: "checkout",
          identityId: memberB,
          type: "room-renamed",
          reason: "Attempt while left.",
          data: { title: "Not allowed" },
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError &&
        error.code === "ROOM_MEMBERSHIP_REQUIRED",
    );

    const rejoined = await joinRoom(
      {
        forumAlias: "a-team",
        room: "checkout",
        identityId: memberB,
        now: new Date("2026-07-12T10:50:00.000Z"),
      },
      paths,
    );
    assert.equal(rejoined.action, "updated");
    assert.equal(rejoined.member.joinedAt, originalJoinedAt);
    assert.equal(rejoined.member.status, "active");
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("room lifecycle events derive rename, description, archive, and restore state", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-room-events-"));
  try {
    const { paths, forum } = await setupForum(home);
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
    const renamed = await createRoomEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        type: "room-renamed",
        reason: "The room now includes payments.",
        data: { title: "Checkout and Payment" },
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad1",
        now: new Date("2026-07-12T10:30:00.000Z"),
      },
      paths,
    );
    assert.equal(renamed.room.title, "Checkout and Payment");
    await assert.rejects(
      createRoomEvent(
        {
          forumAlias: "a-team",
          room: "checkout",
          type: "room-description-changed",
          reason: "Event ID collision.",
          data: { description: "Must not replace the rename event" },
          eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad1",
          now: new Date("2026-07-12T10:30:30.000Z"),
        },
        paths,
      ),
      (error) =>
        error instanceof StorageError &&
        error.code === "IMMUTABLE_PATH_EXISTS",
    );
    assert.equal(
      (await showRoom("a-team", "checkout", paths)).room.title,
      "Checkout and Payment",
    );
    const described = await createRoomEvent(
      {
        forumAlias: "a-team",
        room: roomId,
        type: "room-description-changed",
        reason: "Clarify the expanded scope.",
        data: { description: "Checkout and payment collaboration" },
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad2",
        now: new Date("2026-07-12T10:31:00.000Z"),
      },
      paths,
    );
    assert.equal(described.room.description, "Checkout and payment collaboration");
    const archived = await createRoomEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        type: "room-archived",
        reason: "The feature has shipped.",
        data: {},
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad3",
        now: new Date("2026-07-12T10:32:00.000Z"),
      },
      paths,
    );
    assert.equal(archived.room.status, "archived");
    await assert.rejects(
      createRoomEvent(
        {
          forumAlias: "a-team",
          room: "checkout",
          type: "room-archived",
          reason: "Duplicate archive.",
          data: {},
        },
        paths,
      ),
      (error) =>
        error instanceof StateTransitionError &&
        error.code === "INVALID_STATE_TRANSITION",
    );
    const restored = await createRoomEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        type: "room-restored",
        reason: "Follow-up work is required.",
        data: {},
        eventId: "evt_0194f6d2-8c10-7a31-9e42-123456789ad4",
        now: new Date("2026-07-12T10:33:00.000Z"),
      },
      paths,
    );
    assert.equal(restored.room.status, "active");

    const shown = await showRoom("a-team", "checkout", paths);
    assert.equal(shown.room.title, "Checkout and Payment");
    assert.equal(shown.room.description, "Checkout and payment collaboration");
    assert.equal(shown.room.status, "active");
    assert.equal(shown.room.lastActivityAt, "2026-07-12T10:33:00.000Z");
    assert.equal(shown.warnings.length, 0);
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "6",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("room CLI rejects incomplete commands without touching user state", async () => {
  const output = captureIo();
  const exitCode = await runCli(
    ["room", "create", "--forum", "a-team", "--json"],
    output.io,
  );
  assert.equal(exitCode, 2);
  const result = JSON.parse(output.stdout.join(""));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_ARGUMENT");
});
