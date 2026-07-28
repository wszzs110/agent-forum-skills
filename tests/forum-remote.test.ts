import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity, loadLocalConfig } from "../src/config/local-config.js";
import { redactGitOutput, requireGit } from "../src/git/runner.js";
import { validateRemoteUrl } from "../src/git/remote.js";
import { ServiceError } from "../src/services/errors.js";
import {
  addRemoteForum,
  getForumRemoteStatus,
  listRemoteForums,
  publishLocalForum,
  removeLocalForum,
} from "../src/services/forum-remote.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom } from "../src/services/room.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setupLocalForum(home: string, alias = "a-team") {
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
      alias,
      name: "A Team",
      description: "Engineering",
      forumId,
      dataBranch: "forum-data",
      now: createdAt,
    },
    paths,
  );
  return { paths, forum };
}

async function createBareRemote(root: string, name = "forum.git") {
  const remote = resolve(root, name);
  requireGit(root, ["init", "--bare", "--initial-branch=forum-data", remote]);
  return remote;
}

test("remote URL validation rejects embedded HTTP credentials and redacts local paths", () => {
  assert.equal(
    redactGitOutput(
      "fatal: https://user:secret@example.com/repo.git?token=abc&x=y#private",
    ),
    "fatal: https://***@example.com/repo.git?token=***&x=***#***",
  );
  assert.throws(
    () => validateRemoteUrl("https://token@example.com/team/forum.git"),
    (error) =>
      error instanceof ServiceError && error.code === "REMOTE_URL_UNSAFE",
  );
  assert.throws(
    () => validateRemoteUrl("https://user:secret@example.com/team/forum.git"),
    (error) =>
      error instanceof ServiceError && error.code === "REMOTE_URL_UNSAFE",
  );
  assert.throws(
    () => validateRemoteUrl("https://example.com/team/forum.git?token=secret"),
    (error) =>
      error instanceof ServiceError && error.code === "REMOTE_URL_UNSAFE",
  );
  assert.throws(
    () => validateRemoteUrl("--upload-pack=evil.git"),
    (error) =>
      error instanceof ServiceError && error.code === "REMOTE_URL_UNSAFE",
  );
  assert.equal(
    validateRemoteUrl("git@example.com:team/forum.git").display,
    "git@example.com:team/forum.git",
  );
});

test("a local forum publishes to origin and another home clones and validates it", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-remote-publish-"));
  try {
    const source = await setupLocalForum(resolve(root, "source-home"));
    const remote = await createBareRemote(root);
    const published = await publishLocalForum(
      { forumAlias: "a-team", remote },
      source.paths,
    );
    assert.equal(published.remote, "<local-path>");
    assert.equal(published.branch, "forum-data");
    assert.equal(
      requireGit(source.forum.path, ["remote", "get-url", "origin"]).stdout.trim(),
      remote,
    );
    assert.equal(
      requireGit(remote, ["rev-parse", "refs/heads/forum-data"]).stdout.trim(),
      published.commit,
    );
    requireGit(remote, ["symbolic-ref", "HEAD", "refs/heads/forum-data"]);

    const sourceStatus = await getForumRemoteStatus("a-team", source.paths);
    assert.equal(sourceStatus.health, "ready");
    assert.equal(sourceStatus.remote.ahead, 0);
    assert.equal(sourceStatus.remote.behind, 0);
    assert.equal(sourceStatus.remote.displayUrl, "<local-path>");

    const targetPaths = createAgentForumPaths(resolve(root, "target-home"));
    const added = await addRemoteForum(
      { alias: "shared", remote, now: createdAt },
      targetPaths,
    );
    assert.equal(added.forumId, forumId);
    assert.equal(added.dataBranch, "forum-data");
    assert.equal(
      requireGit(added.path, ["branch", "--show-current"]).stdout.trim(),
      "forum-data",
    );
    assert.equal(
      requireGit(added.path, ["config", "--bool", "core.longpaths"]).stdout.trim(),
      "true",
    );
    assert.equal(
      requireGit(added.path, ["rev-parse", "@{upstream}"]).stdout.trim(),
      published.commit,
    );
    const list = await listRemoteForums(targetPaths);
    assert.equal(list.forums.length, 1);
    assert.equal(list.forums[0]?.health, "ready");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forum add supports an explicit branch and rolls back invalid protocol clones", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-remote-invalid-"));
  try {
    const source = await setupLocalForum(resolve(root, "source-home"));
    const remote = await createBareRemote(root, "valid.git");
    await publishLocalForum({ forumAlias: "a-team", remote }, source.paths);

    const targetPaths = createAgentForumPaths(resolve(root, "target-home"));
    const added = await addRemoteForum(
      { alias: "explicit", remote, branch: "forum-data", now: createdAt },
      targetPaths,
    );
    assert.equal(added.dataBranch, "forum-data");

    const invalidRepository = resolve(root, "invalid-source");
    requireGit(root, ["init", "--initial-branch=main", invalidRepository]);
    requireGit(invalidRepository, ["config", "user.name", "Invalid Forum"]);
    requireGit(invalidRepository, ["config", "user.email", "invalid@example.invalid"]);
    await writeFile(resolve(invalidRepository, "README.md"), "not a forum\n", "utf8");
    requireGit(invalidRepository, ["add", "README.md"]);
    requireGit(invalidRepository, ["commit", "-m", "Initial"]);
    const invalidRemote = await createBareRemote(root, "invalid.git");
    requireGit(invalidRepository, ["remote", "add", "origin", invalidRemote]);
    requireGit(invalidRepository, ["push", "-u", "origin", "main:forum-data"]);
    requireGit(invalidRemote, ["symbolic-ref", "HEAD", "refs/heads/forum-data"]);

    await assert.rejects(
      addRemoteForum(
        { alias: "invalid", remote: invalidRemote, now: createdAt },
        targetPaths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "REMOTE_PROTOCOL_INVALID",
    );
    await assert.rejects(
      access(resolve(targetPaths.forumsDirectory, "invalid")),
    );
    assert.equal(
      (await loadLocalConfig(targetPaths)).forums.some(
        (forum) => forum.alias === "invalid",
      ),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forum status reports local-only commits and remove protects unpublished work", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-remote-status-"));
  try {
    const source = await setupLocalForum(resolve(root, "source-home"));
    const remote = await createBareRemote(root);
    await publishLocalForum({ forumAlias: "a-team", remote }, source.paths);
    await createRoom(
      {
        forumAlias: "a-team",
        slug: "checkout",
        title: "Checkout",
        description: "Checkout collaboration",
        roomId,
        now: createdAt,
      },
      source.paths,
    );
    // 协议写入会自动发布；用独立本地提交覆盖 remove 对遗留未发布提交的保护。
    requireGit(source.forum.path, ["commit", "--allow-empty", "-m", "Unpublished local commit"]);
    const ahead = await getForumRemoteStatus("a-team", source.paths);
    assert.equal(ahead.remote.ahead, 1);
    assert.equal(ahead.remote.behind, 0);
    await assert.rejects(
      removeLocalForum({ forumAlias: "a-team" }, source.paths),
      (error) =>
        error instanceof ServiceError &&
        error.code === "LOCAL_COMMITS_NOT_PUSHED",
    );
    assert.equal((await loadLocalConfig(source.paths)).forums.length, 1);

    await publishLocalForum({ forumAlias: "a-team", remote }, source.paths);
    const ready = await getForumRemoteStatus("a-team", source.paths);
    assert.equal(ready.remote.ahead, 0);
    const forumPath = source.forum.path;
    const removed = await removeLocalForum(
      { forumAlias: "a-team" },
      source.paths,
    );
    assert.equal(removed.clone, "deleted");
    assert.equal((await loadLocalConfig(source.paths)).forums.length, 0);
    await assert.rejects(access(forumPath));
    assert.equal(
      requireGit(remote, ["rev-parse", "refs/heads/forum-data"]).status,
      0,
      "local removal must never delete the remote",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forum remove can unregister a local-only forum while retaining its clone", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-remote-keep-"));
  try {
    const source = await setupLocalForum(resolve(root, "source-home"));
    const result = await removeLocalForum(
      { forumAlias: "a-team", keepClone: true },
      source.paths,
    );
    assert.equal(result.clone, "kept");
    await access(source.forum.path);
    assert.equal((await loadLocalConfig(source.paths)).forums.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
