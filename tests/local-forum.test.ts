import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  createLocalIdentity,
  findIdentity,
  loadLocalConfig,
  saveLocalConfig,
} from "../src/config/local-config.js";
import { runCli, type CliIo } from "../src/cli.js";
import { GitCommandError, requireGit } from "../src/git/runner.js";
import { ServiceError } from "../src/services/errors.js";
import { StorageError } from "../src/storage/errors.js";
import {
  initLocalForum,
  publishIdentity,
} from "../src/services/local-forum.js";
import { createRoom } from "../src/services/room.js";
import { createThread } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
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

test("local identities are schema-validated and default selection is stable", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-identity-"));
  const paths = createAgentForumPaths(home);
  try {
    const first = await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Order service",
        client: "pi",
        now: createdAt,
      },
      paths,
    );
    assert.equal(first.defaultIdentityId, memberA);

    const second = await createLocalIdentity(
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
    assert.equal(second.defaultIdentityId, memberA);

    const config = await loadLocalConfig(paths);
    assert.equal(config.identities.length, 2);
    assert.equal(findIdentity(config).memberId, memberA);
    assert.equal(findIdentity(config, memberB).displayName, "Frontend B");
    await assert.rejects(
      createLocalIdentity(
        {
          memberId: memberA,
          displayName: "Duplicate",
          role: "backend",
          responsibility: "Duplicate",
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "IDENTITY_EXISTS",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("local config rejects ambiguous identities and forum paths outside managed aliases", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-config-semantics-"));
  const paths = createAgentForumPaths(home);
  try {
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
    const config = await loadLocalConfig(paths);
    await assert.rejects(
      saveLocalConfig(paths, {
        ...config,
        forums: [
          {
            alias: "a-team",
            forumId,
            path: resolve(home, "outside-forum"),
            dataBranch: "main",
            createdAt: createdAt.toISOString(),
          },
        ],
      }),
      (error) =>
        error instanceof StorageError &&
        error.code === "SCHEMA_VALIDATION_FAILED",
    );
    await assert.rejects(
      saveLocalConfig(paths, {
        ...config,
        identities: [...config.identities, config.identities[0]!],
      }),
      (error) =>
        error instanceof StorageError &&
        error.code === "SCHEMA_VALIDATION_FAILED",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("forum init creates an immutable protocol repository and initial public member", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-init-"));
  const paths = createAgentForumPaths(home);
  try {
    await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Order service",
        client: "pi",
        now: createdAt,
      },
      paths,
    );
    const result = await initLocalForum(
      {
        alias: "a-team",
        name: "A Team Forum",
        description: "Engineering collaboration",
        dataBranch: "forum-data",
        forumId,
        now: createdAt,
      },
      paths,
    );

    assert.equal(result.path, resolve(paths.forumsDirectory, "a-team"));
    assert.equal(
      requireGit(result.path, ["branch", "--show-current"]).stdout.trim(),
      "forum-data",
    );
    assert.equal(
      requireGit(result.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "1",
    );
    assert.equal(requireGit(result.path, ["status", "--porcelain"]).stdout, "");
    assert.equal(requireGit(result.path, ["remote"]).stdout, "");

    const protocol = JSON.parse(
      await readFile(resolve(result.path, ".forum", "protocol.json"), "utf8"),
    );
    assert.deepEqual(protocol, {
      protocolVersion: "1.0",
      stability: "draft",
      forumId,
      dataBranch: "forum-data",
      createdAt: createdAt.toISOString(),
    });
    const profilePath = resolve(
      result.path,
      "members",
      memberA,
      "profile.json",
    );
    const profile = JSON.parse(await readFile(profilePath, "utf8"));
    assert.equal(profile.displayName, "Backend A");
    assert.equal(profile.status, "active");

    const config = await loadLocalConfig(paths);
    assert.deepEqual(config.forums, [
      {
        alias: "a-team",
        forumId,
        path: result.path,
        dataBranch: "forum-data",
        createdAt: createdAt.toISOString(),
      },
    ]);

    assert.equal(
      requireGit(result.path, ["config", "--bool", "core.longpaths"]).stdout.trim(),
      "true",
    );

    const unchanged = await publishIdentity(
      "a-team",
      undefined,
      paths,
      new Date("2026-07-12T10:30:00.000Z"),
    );
    assert.equal(unchanged.action, "unchanged");
    assert.equal(
      requireGit(result.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "1",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("managed forums support deeply nested message paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-long-path-"));
  const home = resolve(root, `nested-${"x".repeat(40)}`);
  const paths = createAgentForumPaths(home);
  try {
    await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Long path verification",
        now: createdAt,
      },
      paths,
    );
    await initLocalForum(
      {
        alias: "a-team",
        name: "A Team Forum",
        description: "Long path verification",
        forumId,
        now: createdAt,
      },
      paths,
    );
    await createRoom(
      {
        forumAlias: "a-team",
        slug: "long-path",
        title: "Long Path",
        description: "Exercise nested protocol storage",
        roomId: "room_0194f6d2-8c10-7a31-9e42-123456789abd",
        now: createdAt,
      },
      paths,
    );
    const created = await createThread(
      {
        forumAlias: "a-team",
        room: "long-path",
        kind: "discussion",
        title: "Nested message",
        body: "Git must index this nested message path.",
        threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789abe",
        messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789abf",
        now: createdAt,
      },
      paths,
    );
    assert.equal(created.thread.messageCount, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("identity publish updates only the member-owned file and commits it", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-publish-"));
  const paths = createAgentForumPaths(home);
  try {
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
        name: "A Team Forum",
        description: "Engineering",
        forumId,
        now: createdAt,
      },
      paths,
    );
    const config = await loadLocalConfig(paths);
    const updated = {
      ...config,
      identities: config.identities.map((identity) =>
        identity.memberId === memberA
          ? {
              ...identity,
              responsibility: "Order and payment services",
              updatedAt: "2026-07-12T10:40:00.000Z",
            }
          : identity,
      ),
    };
    await saveLocalConfig(paths, updated);

    const published = await publishIdentity(
      "a-team",
      memberA,
      paths,
      new Date("2026-07-12T10:40:00.000Z"),
    );
    assert.equal(published.action, "published");
    assert.equal(typeof published.commit, "string");
    assert.equal(
      requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(),
      "2",
    );
    const profile = JSON.parse(await readFile(published.path, "utf8"));
    assert.equal(profile.responsibility, "Order and payment services");
    assert.equal(requireGit(forum.path, ["status", "--porcelain"]).stdout, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("forum initialization requires an identity and refuses duplicate aliases", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-init-errors-"));
  const paths = createAgentForumPaths(home);
  try {
    await assert.rejects(
      initLocalForum({
        alias: "a-team",
        name: "A Team",
        description: "Engineering",
      }, paths),
      (error) =>
        error instanceof ServiceError &&
        error.code === "DEFAULT_IDENTITY_REQUIRED",
    );
    await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Order service",
      },
      paths,
    );
    await initLocalForum(
      {
        alias: "a-team",
        name: "A Team",
        description: "Engineering",
      },
      paths,
    );
    await assert.rejects(
      initLocalForum({
        alias: "a-team",
        name: "Duplicate",
        description: "Duplicate",
      }, paths),
      (error) =>
        error instanceof ServiceError && error.code === "FORUM_ALIAS_EXISTS",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("identity publish refuses a managed forum on the wrong branch", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-wrong-branch-"));
  const paths = createAgentForumPaths(home);
  try {
    await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Order service",
      },
      paths,
    );
    const forum = await initLocalForum(
      {
        alias: "a-team",
        name: "A Team",
        description: "Engineering",
      },
      paths,
    );
    requireGit(forum.path, ["switch", "-c", "other"]);
    await assert.rejects(
      publishIdentity("a-team", undefined, paths),
      (error) =>
        error instanceof ServiceError &&
        error.code === "FORUM_PROTOCOL_MISMATCH",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("identity publish refuses a dirty managed forum worktree", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dirty-"));
  const paths = createAgentForumPaths(home);
  try {
    await createLocalIdentity(
      {
        memberId: memberA,
        displayName: "Backend A",
        role: "backend",
        responsibility: "Order service",
      },
      paths,
    );
    const forum = await initLocalForum(
      {
        alias: "a-team",
        name: "A Team",
        description: "Engineering",
      },
      paths,
    );
    await writeFile(resolve(forum.path, "unexpected.txt"), "dirty\n", "utf8");
    await assert.rejects(
      publishIdentity("a-team", undefined, paths),
      (error) =>
        error instanceof GitCommandError &&
        error.code === "GIT_DIRTY_WORKTREE",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("forum and identity CLI validate arguments without touching user state", async () => {
  const forumOutput = captureIo();
  const forumExit = await runCli(
    ["forum", "init-local", "--alias", "a-team", "--json"],
    forumOutput.io,
  );
  assert.equal(forumExit, 2);
  assert.equal(JSON.parse(forumOutput.stdout.join("")).error.code, "INVALID_ARGUMENT");

  const identityOutput = captureIo();
  const identityExit = await runCli(
    ["identity", "create", "--name", "Agent", "--json"],
    identityOutput.io,
  );
  assert.equal(identityExit, 2);
  assert.equal(
    JSON.parse(identityOutput.stdout.join("")).error.code,
    "INVALID_ARGUMENT",
  );
});
