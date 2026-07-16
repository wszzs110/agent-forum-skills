import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity, loadLocalConfig, saveLocalConfig } from "../src/config/local-config.js";
import {
  ContextError,
  discoverGitWorkspace,
  loadContextBindingState,
  normalizeRepositoryFingerprint,
  normalizeWorkspaceKey,
} from "../src/context/bindings.js";
import { runCli, type CliIo } from "../src/cli.js";
import { requireGit } from "../src/git/runner.js";
import {
  bindContext,
  listContextBindings,
  resolveContext,
  unbindContext,
} from "../src/services/context.js";
import { ServiceError } from "../src/services/errors.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom, createRoomEvent } from "../src/services/room.js";
import { StorageError } from "../src/storage/errors.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberId = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const checkoutRoomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const supportRoomId = "room_0194f6d2-8c10-7a31-9e42-123456789abe";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setupForum(home: string) {
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
      roomId: checkoutRoomId,
      now: createdAt,
    },
    paths,
  );
  await createRoom(
    {
      forumAlias: "a-team",
      slug: "support",
      title: "Support",
      description: "Support collaboration",
      roomId: supportRoomId,
      now: createdAt,
    },
    paths,
  );
  return { paths, forum };
}

async function createBusinessRepository(root: string, name: string) {
  const repository = resolve(root, name);
  requireGit(root, ["init", "--initial-branch=main", repository]);
  requireGit(repository, ["config", "user.name", "Context Test"]);
  requireGit(repository, ["config", "user.email", "context@example.invalid"]);
  await writeFile(resolve(repository, "README.md"), "context test\n", "utf8");
  requireGit(repository, ["add", "README.md"]);
  requireGit(repository, ["commit", "-m", "Initial commit"]);
  requireGit(repository, [
    "remote",
    "add",
    "origin",
    "https://secret-token@example.com/team/shop.git",
  ]);
  return repository;
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

test("production workspace keys and repository fingerprints are platform-safe and credential-free", () => {
  assert.equal(
    normalizeWorkspaceKey("C:\\Code\\Shop\\..\\Forum\\", "win32"),
    "win32:c:/code/forum",
  );
  assert.equal(
    normalizeWorkspaceKey("\\\\Server\\Share\\Repo\\", "win32"),
    "win32://server/share/repo",
  );
  assert.equal(
    normalizeWorkspaceKey("/home/alice/shop/../forum/", "linux"),
    "linux:/home/alice/forum",
  );
  assert.equal(
    normalizeWorkspaceKey("/Users/Alice/Forum/", "darwin"),
    "darwin:/Users/Alice/Forum",
  );
  assert.equal(
    normalizeRepositoryFingerprint("https://token@example.com/org/repo.git"),
    "example.com/org/repo",
  );
  assert.equal(
    normalizeRepositoryFingerprint("git@example.com:org/repo.git"),
    "example.com/org/repo",
  );
  assert.equal(normalizeRepositoryFingerprint("D:\\code\\repo.git"), undefined);
});

test("explicit targets override branch bindings, which override workspace defaults", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-order-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const repository = await createBusinessRepository(root, "business");
    requireGit(repository, ["switch", "-c", "feature/checkout"]);

    const workspace = await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: repository,
        workspace: true,
        bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac2",
        now: createdAt,
      },
      paths,
    );
    assert.equal(workspace.binding.scope, "workspace");
    assert.equal(workspace.target.roomId, checkoutRoomId);

    const branch = await bindContext(
      {
        forumAlias: "a-team",
        room: "support",
        cwd: repository,
        bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac3",
        now: createdAt,
      },
      paths,
    );
    assert.equal(branch.binding.scope, "branch");
    assert.equal((await resolveContext({ cwd: repository }, paths)).source, "branch");
    assert.equal(
      (await resolveContext({ cwd: repository }, paths)).roomId,
      supportRoomId,
    );

    const explicit = await resolveContext(
      { forumAlias: "a-team", room: "checkout" },
      paths,
    );
    assert.equal(explicit.source, "explicit");
    assert.equal(explicit.context, null);
    assert.equal(explicit.roomId, checkoutRoomId);

    requireGit(repository, ["switch", "-c", "feature/other"]);
    const switched = await resolveContext({ cwd: repository }, paths);
    assert.equal(switched.source, "workspace");
    assert.equal(switched.roomId, checkoutRoomId);

    requireGit(repository, ["checkout", "--detach"]);
    const detached = await resolveContext({ cwd: repository }, paths);
    assert.equal(detached.source, "workspace");
    assert.equal(detached.context?.branch, null);

    const listed = await listContextBindings(paths);
    assert.equal(listed.bindings.length, 2);
    assert.equal(
      listed.bindings.every((item) => item.targetStatus === "active"),
      true,
    );
    assert.equal(
      listed.bindings[0]?.binding.repositoryFingerprint,
      "example.com/team/shop",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("branch binding replacement requires force and unbind scopes are independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-force-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const repository = await createBusinessRepository(root, "business");
    requireGit(repository, ["switch", "-c", "feature/checkout"]);
    const initial = await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: repository,
        bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac4",
        now: createdAt,
      },
      paths,
    );
    await bindContext(
      {
        forumAlias: "a-team",
        room: "support",
        cwd: repository,
        workspace: true,
        bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac5",
        now: createdAt,
      },
      paths,
    );
    await assert.rejects(
      bindContext(
        {
          forumAlias: "a-team",
          room: "support",
          cwd: repository,
        },
        paths,
      ),
      (error) =>
        error instanceof ContextError && error.code === "BINDING_EXISTS",
    );
    const replaced = await bindContext(
      {
        forumAlias: "a-team",
        room: "support",
        cwd: repository,
        force: true,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    assert.equal(replaced.action, "replaced");
    assert.equal(replaced.binding.bindingId, initial.binding.bindingId);
    assert.equal(replaced.binding.createdAt, initial.binding.createdAt);
    assert.equal(replaced.binding.roomId, supportRoomId);

    const removedBranch = await unbindContext({ cwd: repository }, paths);
    assert.equal(removedBranch.removed.length, 1);
    assert.equal((await resolveContext({ cwd: repository }, paths)).source, "workspace");
    const removedWorkspace = await unbindContext(
      { cwd: repository, workspace: true },
      paths,
    );
    assert.equal(removedWorkspace.removed.length, 1);
    await assert.rejects(
      resolveContext({ cwd: repository }, paths),
      (error) =>
        error instanceof ContextError && error.code === "CONTEXT_NOT_BOUND",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("archived targets remain resolvable but reject new bindings", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-archive-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const firstRepository = await createBusinessRepository(root, "first");
    const secondRepository = await createBusinessRepository(root, "second");
    await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: firstRepository,
        workspace: true,
        now: createdAt,
      },
      paths,
    );
    await createRoomEvent(
      {
        forumAlias: "a-team",
        room: "checkout",
        type: "room-archived",
        reason: "The work is complete.",
        data: {},
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    const resolved = await resolveContext({ cwd: firstRepository }, paths);
    assert.equal(resolved.targetStatus, "archived");
    await assert.rejects(
      bindContext(
        {
          forumAlias: "a-team",
          room: "checkout",
          cwd: secondRepository,
          workspace: true,
        },
        paths,
      ),
      (error) =>
        error instanceof ServiceError && error.code === "ROOM_ARCHIVED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detached HEAD requires a workspace default or an explicit branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-detached-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const repository = await createBusinessRepository(root, "business");
    requireGit(repository, ["checkout", "--detach"]);
    await assert.rejects(
      bindContext(
        { forumAlias: "a-team", room: "checkout", cwd: repository },
        paths,
      ),
      (error) =>
        error instanceof ContextError && error.code === "GIT_BRANCH_REQUIRED",
    );
    const explicit = await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: repository,
        branch: "future/work",
        now: createdAt,
      },
      paths,
    );
    assert.equal(explicit.binding.scope, "branch");
    assert.equal(
      explicit.binding.scope === "branch" ? explicit.binding.branch : "",
      "future/work",
    );
    await assert.rejects(
      resolveContext({ cwd: repository }, paths),
      (error) =>
        error instanceof ContextError && error.code === "CONTEXT_NOT_BOUND",
    );
    await bindContext(
      {
        forumAlias: "a-team",
        room: "support",
        cwd: repository,
        workspace: true,
        now: createdAt,
      },
      paths,
    );
    assert.equal((await resolveContext({ cwd: repository }, paths)).source, "workspace");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("linked worktrees have independent local workspace keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-worktree-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const repository = await createBusinessRepository(root, "business");
    const linked = resolve(root, "linked");
    requireGit(repository, ["worktree", "add", "-b", "linked-work", linked, "main"]);
    const primaryContext = await discoverGitWorkspace(repository);
    const linkedContext = await discoverGitWorkspace(linked);
    assert.notEqual(primaryContext.workspaceKey, linkedContext.workspaceKey);
    await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: repository,
        workspace: true,
        now: createdAt,
      },
      paths,
    );
    await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: linked,
        workspace: true,
        now: createdAt,
      },
      paths,
    );
    assert.equal((await listContextBindings(paths)).bindings.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("binding state rejects schema damage and reports stale local targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-damage-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    await mkdir(resolve(paths.bindingsFile, ".."), { recursive: true });
    await writeFile(
      paths.bindingsFile,
      JSON.stringify({ formatVersion: 1, bindings: [{ unsafe: true }] }),
      "utf8",
    );
    await assert.rejects(
      loadContextBindingState(paths),
      (error) =>
        error instanceof StorageError &&
        error.code === "SCHEMA_VALIDATION_FAILED",
    );
    await writeFile(paths.bindingsFile, "{not-json", "utf8");
    await assert.rejects(
      loadContextBindingState(paths),
      (error) =>
        error instanceof StorageError &&
        error.code === "SCHEMA_VALIDATION_FAILED",
    );
    await rm(paths.bindingsFile, { force: true });

    const repository = await createBusinessRepository(root, "business");
    await bindContext(
      {
        forumAlias: "a-team",
        room: "checkout",
        cwd: repository,
        workspace: true,
        now: createdAt,
      },
      paths,
    );
    const config = await loadLocalConfig(paths);
    await saveLocalConfig(paths, { ...config, forums: [] });
    const listed = await listContextBindings(paths);
    assert.equal(listed.bindings[0]?.targetStatus, "missing");
    await assert.rejects(
      resolveContext({ cwd: repository }, paths),
      (error) =>
        error instanceof ContextError &&
        error.code === "BINDING_TARGET_UNAVAILABLE",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("non-Git directories fail and concurrent binding writes serialize", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-context-lock-"));
  const home = resolve(root, "home");
  try {
    const { paths } = await setupForum(home);
    const nonGit = resolve(root, "not-git");
    await mkdir(nonGit, { recursive: true });
    await assert.rejects(
      bindContext(
        { forumAlias: "a-team", room: "checkout", cwd: nonGit },
        paths,
      ),
      (error) =>
        error instanceof ContextError &&
        error.code === "GIT_WORKSPACE_REQUIRED",
    );

    const repository = await createBusinessRepository(root, "business");
    const results = await Promise.allSettled([
      bindContext(
        {
          forumAlias: "a-team",
          room: "checkout",
          cwd: repository,
          workspace: true,
          bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac6",
          now: createdAt,
        },
        paths,
      ),
      bindContext(
        {
          forumAlias: "a-team",
          room: "support",
          cwd: repository,
          workspace: true,
          bindingId: "binding_0194f6d2-8c10-7a31-9e42-123456789ac7",
          now: createdAt,
        },
        paths,
      ),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          ((result.reason instanceof ContextError &&
            result.reason.code === "BINDING_EXISTS") ||
            (result.reason instanceof StorageError &&
              result.reason.code === "LOCAL_LOCKED")),
      ).length,
      1,
    );
    assert.equal((await loadContextBindingState(paths)).bindings.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("context CLI validates explicit pairs and mutually exclusive scopes", async () => {
  const pair = captureIo();
  assert.equal(
    await runCli(
      ["context", "resolve", "--forum", "a-team", "--json"],
      pair.io,
    ),
    2,
  );
  assert.equal(JSON.parse(pair.stdout.join("")).error.code, "INVALID_ARGUMENT");

  const scope = captureIo();
  assert.equal(
    await runCli(
      [
        "context",
        "bind",
        "--forum",
        "a-team",
        "--room",
        "checkout",
        "--workspace",
        "--branch",
        "main",
        "--json",
      ],
      scope.io,
    ),
    2,
  );
  assert.equal(JSON.parse(scope.stdout.join("")).error.code, "INVALID_ARGUMENT");
});
