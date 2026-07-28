import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  cleanupTemporaryEntries,
  createImmutableDirectory,
  writeJsonAtomic,
  writeValidatedJsonAtomic,
} from "../src/storage/atomic.js";
import { StorageError } from "../src/storage/errors.js";
import {
  acquireForumLock,
  clearStaleForumLock,
  withForumLock,
} from "../src/storage/lock.js";
import {
  assertLocalAlias,
  createAgentForumPaths,
  forumClonePath,
  forumLockPath,
  resolveInside,
  sameExistingPath,
} from "../src/storage/paths.js";
import {
  createImmutableEvent,
  createImmutableMessage,
} from "../src/storage/protocol-store.js";

const ids = {
  forum: "forum_0194f6d2-8c10-7a31-9e42-123456789abc",
  room: "room_0194f6d2-8c10-7a31-9e42-123456789abd",
  thread: "thread_0194f6d2-8c10-7a31-9e42-123456789abe",
  message: "msg_0194f6d2-8c10-7a31-9e42-123456789abf",
  event: "evt_0194f6d2-8c10-7a31-9e42-123456789ac0",
  member: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
} as const;
const createdAt = "2026-07-12T10:20:30.123Z";

async function missing(path: string): Promise<boolean> {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

function expectStorageCode(code: StorageError["code"]): (error: unknown) => boolean {
  return (error) => error instanceof StorageError && error.code === code;
}

function waitForChildMessage(
  child: ChildProcess,
  expectedType: string,
): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for lock worker")), 10_000);
    child.on("error", reject);
    child.on("message", (message) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === expectedType
      ) {
        clearTimeout(timer);
        resolvePromise(message);
      }
    });
    child.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`lock worker exited with ${code}`));
      }
    });
  });
}

test("AgentForum paths are rooted under home and reject traversal aliases", () => {
  const paths = createAgentForumPaths("/home/alice");
  assert.equal(paths.root, resolve("/home/alice", ".AgentForum"));
  assert.equal(
    forumClonePath(paths, "a-team"),
    resolve("/home/alice", ".AgentForum", "forums", "a-team"),
  );
  assert.doesNotThrow(() => assertLocalAlias("team_1.dev"));
  assert.throws(() => assertLocalAlias("../team"), expectStorageCode("INVALID_LOCAL_ALIAS"));
  assert.throws(
    () => resolveInside(paths.root, "..", "outside"),
    expectStorageCode("PATH_OUTSIDE_ROOT"),
  );
  assert.match(forumLockPath(paths, ids.forum), new RegExp(`${ids.forum}\\.lock$`, "u"));
});

test("existing path identity uses filesystem canonicalization", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-path-identity-"));
  try {
    assert.equal(await sameExistingPath(root, resolve(root, ".")), true);
    if (process.platform === "win32") {
      assert.equal(await sameExistingPath(root, root.toUpperCase()), true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validated JSON is written atomically and immutable files are not replaced", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-atomic-json-"));
  const destination = resolve(root, "protocol.json");
  const value = {
    protocolVersion: "1.0",
    stability: "draft",
    forumId: ids.forum,
    dataBranch: "main",
    createdAt,
  };

  try {
    await writeValidatedJsonAtomic(destination, "protocol", value);
    assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), value);
    await assert.rejects(
      writeValidatedJsonAtomic(destination, "protocol", {
        ...value,
        dataBranch: "other",
      }),
      expectStorageCode("IMMUTABLE_PATH_EXISTS"),
    );
    assert.equal(JSON.parse(await readFile(destination, "utf8")).dataBranch, "main");
    assert.deepEqual(
      (await readdir(root)).filter((name) => name.startsWith(".agent-forum-tmp-")),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("schema failure leaves no file or temporary entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-invalid-json-"));
  const destination = resolve(root, "room.json");
  try {
    await assert.rejects(
      writeValidatedJsonAtomic(destination, "room", { id: "invalid" }),
      expectStorageCode("SCHEMA_VALIDATION_FAILED"),
    );
    assert.equal(await missing(destination), true);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mutable local JSON can be atomically replaced", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-local-json-"));
  const destination = resolve(root, "config.json");
  try {
    await writeJsonAtomic(destination, { value: 1 }, { overwrite: true });
    await writeJsonAtomic(destination, { value: 2 }, { overwrite: true });
    assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), { value: 2 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("immutable message and event directories expose only complete validated data", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-protocol-store-"));
  const messageDirectory = resolve(root, ids.message);
  const eventDirectory = resolve(root, ids.event);
  const message = {
    schemaVersion: "1.0",
    id: ids.message,
    threadId: ids.thread,
    authorId: ids.member,
    type: "proposal",
    createdAt,
    replyTo: null,
    mentions: [],
    references: [],
  };
  const event = {
    schemaVersion: "1.0",
    id: ids.event,
    scope: "thread",
    targetId: ids.thread,
    type: "thread-closed",
    actorId: ids.member,
    createdAt,
    reason: "The decision has been acknowledged.",
    data: {},
  };

  try {
    await createImmutableMessage(messageDirectory, message, "Proposal body.\n");
    await createImmutableEvent(eventDirectory, event);
    assert.deepEqual(
      (await readdir(messageDirectory)).sort(),
      ["body.md", "message.json"],
    );
    assert.deepEqual(await readdir(eventDirectory), ["event.json"]);
    await assert.rejects(
      createImmutableMessage(messageDirectory, message, "Replacement.\n"),
      expectStorageCode("IMMUTABLE_PATH_EXISTS"),
    );
    await assert.rejects(
      createImmutableMessage(resolve(root, "wrong-id"), message, "Body.\n"),
      expectStorageCode("PATH_ID_MISMATCH"),
    );
    await assert.rejects(
      createImmutableMessage(
        resolve(root, "msg_0194f6d2-8c10-7a31-9e42-123456789ac2"),
        { ...message, id: "msg_0194f6d2-8c10-7a31-9e42-123456789ac2", type: "future-type" },
        "Future body.\n",
      ),
      expectStorageCode("UNKNOWN_MESSAGE_TYPE"),
    );
    await assert.rejects(
      createImmutableMessage(
        resolve(root, "msg_0194f6d2-8c10-7a31-9e42-123456789ac3"),
        { ...message, id: "msg_0194f6d2-8c10-7a31-9e42-123456789ac3" },
        "  ",
      ),
      expectStorageCode("INVALID_MESSAGE_BODY"),
    );
    await assert.rejects(
      createImmutableEvent(resolve(root, "evt_0194f6d2-8c10-7a31-9e42-123456789ac4"), {
        ...event,
        id: "evt_0194f6d2-8c10-7a31-9e42-123456789ac4",
        type: "future-event",
      }),
      expectStorageCode("UNKNOWN_EVENT_TYPE"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed immutable directory writers are cleaned without exposing a final path", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-directory-failure-"));
  const destination = resolve(root, "final");
  try {
    await assert.rejects(
      createImmutableDirectory(destination, async (temporary) => {
        await writeFile(resolve(temporary, "partial.txt"), "partial", "utf8");
        throw new Error("simulated interruption");
      }),
      /simulated interruption/u,
    );
    assert.equal(await missing(destination), true);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cleanup removes only old Agent Forum temporary entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-cleanup-"));
  const oldEntry = resolve(root, ".agent-forum-tmp-old");
  const freshEntry = resolve(root, ".agent-forum-tmp-fresh");
  const unrelated = resolve(root, "keep-me");
  try {
    await mkdir(oldEntry);
    await mkdir(freshEntry);
    await mkdir(unrelated);
    const now = Date.now();
    const old = new Date(now - 60_000);
    await utimes(oldEntry, old, old);

    const removed = await cleanupTemporaryEntries(root, {
      olderThanMs: 30_000,
      now,
    });
    assert.deepEqual(removed, [oldEntry]);
    assert.equal(await missing(freshEntry), false);
    assert.equal(await missing(unrelated), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an active lock fails fast and release requires ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-lock-"));
  const lockPath = resolve(root, "forum.lock");
  try {
    const lock = await acquireForumLock({ lockPath, command: "first" });
    await assert.rejects(
      acquireForumLock({ lockPath, command: "second" }),
      expectStorageCode("LOCAL_LOCKED"),
    );
    await lock.release();
    assert.equal(await missing(lockPath), true);

    const changed = await acquireForumLock({ lockPath, command: "changed" });
    const ownerFile = resolve(lockPath, "owner.json");
    const owner = JSON.parse(await readFile(ownerFile, "utf8"));
    await writeFile(
      ownerFile,
      `${JSON.stringify({ ...owner, token: "replacement-token" })}\n`,
      "utf8",
    );
    await assert.rejects(changed.release(), expectStorageCode("LOCK_OWNERSHIP_LOST"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dead same-host locks are reclaimed immediately but live locks are not", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-stale-lock-"));
  const lockPath = resolve(root, "forum.lock");
  const old = new Date("2026-07-12T10:00:00.000Z");
  const later = new Date("2026-07-12T10:00:01.000Z");
  try {
    await acquireForumLock({
      lockPath,
      command: "crashed",
      now: old,
      pid: 999_999,
      hostname: "test-host",
      isProcessAlive: () => false,
    });
    const replacement = await acquireForumLock({
      lockPath,
      command: "replacement",
      now: later,
      hostname: "test-host",
      staleAfterMs: 10 * 60 * 1000,
      isProcessAlive: () => false,
    });
    assert.equal(replacement.owner.command, "replacement");
    await replacement.release();

    await acquireForumLock({
      lockPath,
      command: "still-alive",
      now: old,
      pid: 123,
      hostname: "test-host",
      isProcessAlive: () => true,
    });
    await assert.rejects(
      acquireForumLock({
        lockPath,
        command: "must-not-steal",
        now: later,
        hostname: "test-host",
        staleAfterMs: 1,
        isProcessAlive: () => true,
      }),
      expectStorageCode("LOCAL_LOCKED"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("doctor-style cleanup removes ownerless stale locks only", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-clear-lock-"));
  const lockPath = resolve(root, "forum.lock");
  try {
    await mkdir(lockPath);
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);
    assert.equal(
      await clearStaleForumLock({
        lockPath,
        staleAfterMs: 30_000,
        isProcessAlive: () => false,
      }),
      true,
    );
    assert.equal(await missing(lockPath), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("withForumLock releases after operation failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-with-lock-"));
  const lockPath = resolve(root, "forum.lock");
  try {
    await assert.rejects(
      withForumLock({ lockPath, command: "failing-operation" }, async () => {
        throw new Error("operation failed");
      }),
      /operation failed/u,
    );
    assert.equal(await missing(lockPath), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a separate Node process holds the same atomic directory lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-process-lock-"));
  const lockPath = resolve(root, "forum.lock");
  const child = fork(resolve("tests/fixtures/lock-worker.ts"), [lockPath], {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  try {
    await waitForChildMessage(child, "acquired");
    await assert.rejects(
      acquireForumLock({ lockPath, command: "parent" }),
      expectStorageCode("LOCAL_LOCKED"),
    );
    const released = waitForChildMessage(child, "released");
    child.send("release");
    await released;
    assert.equal(await missing(lockPath), true);
  } finally {
    if (!child.killed) child.kill();
    await rm(root, { recursive: true, force: true });
  }
});
