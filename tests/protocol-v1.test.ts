import assert from "node:assert/strict";
import test from "node:test";
import { createEntityId, isEntityId } from "../src/domain/ids.js";
import { isKnownMessageType } from "../src/domain/message-types.js";
import {
  isKnownThreadKind,
  knownThreadKinds,
} from "../src/domain/thread-kinds.js";
import {
  StateTransitionError,
  applyLifecycleEvent,
  type ForumState,
  type RoomState,
  type ThreadState,
} from "../src/domain/state-transitions.js";
import {
  currentUtcTimestamp,
  isCanonicalUtcTimestamp,
} from "../src/domain/timestamps.js";
import { validateProtocolDocument } from "../src/protocol/validator.js";

const ids = {
  forum: "forum_0194f6d2-8c10-7a31-9e42-123456789abc",
  room: "room_0194f6d2-8c10-7a31-9e42-123456789abd",
  thread: "thread_0194f6d2-8c10-7a31-9e42-123456789abe",
  message: "msg_0194f6d2-8c10-7a31-9e42-123456789abf",
  event: "evt_0194f6d2-8c10-7a31-9e42-123456789ac0",
  member: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
} as const;
const createdAt = "2026-07-12T10:20:30.123Z";

function expectValid(
  schema: Parameters<typeof validateProtocolDocument>[0],
  value: unknown,
): void {
  const result = validateProtocolDocument(schema, value);
  assert.deepEqual(result, { ok: true });
}

test("UUIDv7 entity IDs are lowercase, prefixed, and type-specific", () => {
  for (const kind of [
    "forum",
    "room",
    "thread",
    "message",
    "event",
    "member",
    "binding",
  ] as const) {
    const id = createEntityId(kind);
    assert.equal(isEntityId(id, kind), true);
    assert.equal(id, id.toLowerCase());
  }
  assert.equal(isEntityId(ids.message, "message"), true);
  assert.equal(isEntityId(ids.message, "thread"), false);
  assert.equal(
    isEntityId("msg_550e8400-e29b-41d4-a716-446655440000", "message"),
    false,
    "UUIDv4 must not pass as UUIDv7",
  );
});

test("canonical protocol timestamps require UTC and milliseconds", () => {
  assert.equal(isCanonicalUtcTimestamp(createdAt), true);
  assert.equal(isCanonicalUtcTimestamp("2026-07-12T10:20:30Z"), false);
  assert.equal(isCanonicalUtcTimestamp("2026-07-12T18:20:30.123+08:00"), false);
  assert.equal(
    currentUtcTimestamp(new Date(createdAt)),
    createdAt,
  );
});

test("all 1.0 draft protocol documents validate", () => {
  expectValid("protocol", {
    protocolVersion: "1.0",
    stability: "draft",
    forumId: ids.forum,
    dataBranch: "main",
    createdAt,
  });
  expectValid("forum", {
    schemaVersion: "1.0",
    forumId: ids.forum,
    initialName: "A Team Forum",
    initialDescription: "Engineering collaboration forum",
    createdBy: ids.member,
    createdAt,
  });
  expectValid("member-profile", {
    schemaVersion: "1.0",
    memberId: ids.member,
    displayName: "Backend A",
    role: "backend",
    responsibility: "Order and payment services",
    status: "active",
    client: "pi",
    createdAt,
    updatedAt: createdAt,
  });
  expectValid("room-member", {
    schemaVersion: "1.0",
    roomId: ids.room,
    memberId: ids.member,
    role: "backend",
    responsibility: "Checkout API",
    status: "active",
    joinedAt: createdAt,
    updatedAt: createdAt,
  });
  expectValid("room", {
    schemaVersion: "1.0",
    id: ids.room,
    slug: "checkout",
    initialTitle: "Checkout",
    initialDescription: "Checkout feature collaboration",
    createdBy: ids.member,
    createdAt,
  });
  expectValid("thread", {
    schemaVersion: "1.0",
    id: ids.thread,
    roomId: ids.room,
    initialTitle: "Add currency to the order API",
    kind: "proposal",
    createdBy: ids.member,
    createdAt,
    firstMessageId: ids.message,
  });
  expectValid("message", {
    schemaVersion: "1.0",
    id: ids.message,
    threadId: ids.thread,
    authorId: ids.member,
    type: "proposal",
    createdAt,
    replyTo: null,
    mentions: [],
    references: [{ kind: "endpoint", value: "POST /api/orders" }],
  });
  expectValid("event", {
    schemaVersion: "1.0",
    id: ids.event,
    scope: "thread",
    targetId: ids.thread,
    type: "thread-closed",
    actorId: ids.member,
    createdAt,
    reason: "The migration plan has been confirmed.",
    data: {},
  });
});

test("schemas reject invalid IDs, timestamps, slugs, and extra writer fields", () => {
  const invalidRoom = validateProtocolDocument("room", {
    schemaVersion: "1.0",
    id: "room_not-a-uuid",
    slug: "Checkout Room",
    initialTitle: "Checkout",
    initialDescription: "",
    createdBy: ids.member,
    createdAt: "2026-07-12T10:20:30Z",
    unexpected: true,
  });

  assert.equal(invalidRoom.ok, false);
  if (!invalidRoom.ok) {
    const keywords = new Set(invalidRoom.issues.map((issue) => issue.keyword));
    assert.equal(keywords.has("pattern"), true);
    assert.equal(keywords.has("format"), true);
    assert.equal(keywords.has("additionalProperties"), true);
  }
});

test("read compatibility accepts same-major optional fields but writers remain strict", () => {
  const futureMinor = {
    protocolVersion: "1.1",
    stability: "draft",
    forumId: ids.forum,
    dataBranch: "main",
    createdAt,
    futureOptionalField: true,
  };
  assert.equal(validateProtocolDocument("protocol", futureMinor).ok, false);
  assert.deepEqual(
    validateProtocolDocument("protocol", futureMinor, { mode: "read" }),
    { ok: true },
  );
  assert.equal(
    validateProtocolDocument(
      "protocol",
      { ...futureMinor, protocolVersion: "2.0" },
      { mode: "read" },
    ).ok,
    false,
  );
});

test("event schema requires scope, target ID, and type prefix to agree", () => {
  const invalid = validateProtocolDocument("event", {
    schemaVersion: "1.0",
    id: ids.event,
    scope: "thread",
    targetId: ids.room,
    type: "room-archived",
    actorId: ids.member,
    createdAt,
    reason: "Invalid cross-scope event.",
    data: {},
  });
  assert.equal(invalid.ok, false);
});

test("thread kinds are a strict subset of opening message types", () => {
  assert.deepEqual(knownThreadKinds, [
    "discussion",
    "question",
    "proposal",
    "change",
    "blocker",
    "review",
    "status",
    "test-result",
  ]);
  assert.equal(isKnownThreadKind("proposal"), true);
  assert.equal(isKnownMessageType("proposal"), true);
  assert.equal(isKnownThreadKind("answer"), false);
  assert.equal(
    validateProtocolDocument("thread", {
      schemaVersion: "1.0",
      id: ids.thread,
      roomId: ids.room,
      initialTitle: "Invalid opening kind",
      kind: "answer",
      createdBy: ids.member,
      createdAt,
      firstMessageId: ids.message,
    }).ok,
    false,
  );
});

test("reader schema preserves unknown message types while writers classify known types", () => {
  const value = {
    schemaVersion: "1.0",
    id: ids.message,
    threadId: ids.thread,
    authorId: ids.member,
    type: "future-message-type",
    createdAt,
    replyTo: null,
    mentions: [],
    references: [],
  };
  expectValid("message", value);
  assert.equal(isKnownMessageType(value.type), false);
  assert.equal(isKnownMessageType("correction"), true);
});

test("forum and room lifecycle events are reversible and validated", () => {
  const forum: ForumState = {
    scope: "forum",
    id: ids.forum,
    name: "A Team Forum",
    description: "Engineering",
    status: "active",
  };
  const renamed = applyLifecycleEvent(forum, {
    scope: "forum",
    targetId: ids.forum,
    type: "forum-renamed",
    data: { name: "Platform Forum" },
  });
  assert.equal(renamed.name, "Platform Forum");
  const archived = applyLifecycleEvent(renamed, {
    scope: "forum",
    targetId: ids.forum,
    type: "forum-archived",
    data: {},
  });
  assert.equal(archived.status, "archived");
  const restored = applyLifecycleEvent(archived, {
    scope: "forum",
    targetId: ids.forum,
    type: "forum-restored",
    data: {},
  });
  assert.equal(restored.status, "active");

  const room: RoomState = {
    scope: "room",
    id: ids.room,
    title: "Checkout",
    description: "Checkout feature",
    status: "active",
  };
  assert.equal(
    applyLifecycleEvent(room, {
      scope: "room",
      targetId: ids.room,
      type: "room-description-changed",
      data: { description: "Checkout and payment" },
    }).description,
    "Checkout and payment",
  );
});

test("thread close/reopen rejects repeated or mismatched transitions", () => {
  const thread: ThreadState = {
    scope: "thread",
    id: ids.thread,
    title: "API contract",
    status: "open",
  };
  const closed = applyLifecycleEvent(thread, {
    scope: "thread",
    targetId: ids.thread,
    type: "thread-closed",
    data: {},
  });
  assert.equal(closed.status, "closed");
  assert.throws(
    () =>
      applyLifecycleEvent(closed, {
        scope: "thread",
        targetId: ids.thread,
        type: "thread-closed",
        data: {},
      }),
    (error) =>
      error instanceof StateTransitionError &&
      error.code === "INVALID_STATE_TRANSITION",
  );
  assert.throws(
    () =>
      applyLifecycleEvent(thread, {
        scope: "room",
        targetId: ids.room,
        type: "room-archived",
        data: {},
      }),
    (error) =>
      error instanceof StateTransitionError &&
      error.code === "EVENT_TARGET_MISMATCH",
  );
});
