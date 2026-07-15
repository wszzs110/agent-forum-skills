import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  ContextExperimentError,
  addBinding,
  agentForumRoot,
  discoverGitWorkspace,
  emptyBindingState,
  loadBindingState,
  normalizeRepositoryFingerprint,
  normalizeWorkspaceKey,
  removeBinding,
  resolveBinding,
  saveBindingState,
  type BindingInput,
  type GitWorkspaceContext,
} from "../experiments/phase-0/context-binding.js";
import {
  configureExperimentIdentity,
  requireGit,
} from "../experiments/phase-0/git.js";

const now = "2026-07-12T17:00:00.000Z";

function branchInput(
  context: GitWorkspaceContext,
  branch: string,
  roomId: string,
): BindingInput {
  return {
    scope: "branch",
    branch,
    workspaceKey: context.workspaceKey,
    workspaceRoot: context.workspaceRoot,
    forumId: "a-team",
    roomId,
    ...(context.repositoryFingerprint
      ? { repositoryFingerprint: context.repositoryFingerprint }
      : {}),
  };
}

function workspaceInput(
  context: GitWorkspaceContext,
  roomId: string,
): BindingInput {
  return {
    scope: "workspace",
    workspaceKey: context.workspaceKey,
    workspaceRoot: context.workspaceRoot,
    forumId: "a-team",
    roomId,
    ...(context.repositoryFingerprint
      ? { repositoryFingerprint: context.repositoryFingerprint }
      : {}),
  };
}

function requireBound(
  state: ReturnType<typeof emptyBindingState>,
  context: GitWorkspaceContext,
) {
  const result = resolveBinding(state, context);
  if (result.kind !== "bound") assert.fail("expected context to be bound");
  return result;
}

test("home and workspace paths normalize with platform-specific semantics", () => {
  assert.equal(
    agentForumRoot("C:\\Users\\Alice", "win32"),
    "C:\\Users\\Alice\\.AgentForum",
  );
  assert.equal(agentForumRoot("/home/alice", "linux"), "/home/alice/.AgentForum");
  assert.equal(agentForumRoot("/Users/alice", "darwin"), "/Users/alice/.AgentForum");

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
    "macOS keys preserve case because case-sensitive volumes are valid",
  );
});

test("repository fingerprints remove credentials and ignore local paths", () => {
  assert.equal(
    normalizeRepositoryFingerprint("https://token@example.com/org/repo.git"),
    "example.com/org/repo",
  );
  assert.equal(
    normalizeRepositoryFingerprint("git@example.com:org/repo.git"),
    "example.com/org/repo",
  );
  assert.equal(normalizeRepositoryFingerprint("D:\\code\\repo.git"), undefined);
  assert.equal(normalizeRepositoryFingerprint("/home/alice/repo.git"), undefined);
});

test("exact branch bindings override workspace defaults and unbind independently", () => {
  const context: GitWorkspaceContext = {
    workspaceRoot: "/code/shop",
    workspaceKey: "linux:/code/shop",
    branch: "a1",
    repositoryFingerprint: "example.com/team/shop",
  };
  let state = addBinding(
    emptyBindingState(),
    branchInput(context, "a1", "room-a1"),
    {
      now,
      bindingId: "binding_22222222-2222-2222-2222-222222222222",
    },
  ).state;
  assert.deepEqual(resolveBinding(state, { ...context, branch: "b1" }), {
    kind: "unbound",
    code: "CONTEXT_NOT_BOUND",
  });

  state = addBinding(state, workspaceInput(context, "default-room"), {
    now,
    bindingId: "binding_11111111-1111-1111-1111-111111111111",
  }).state;

  const exact = resolveBinding(state, context);
  assert.equal(exact.kind, "bound");
  assert.equal(exact.source, "branch");
  assert.equal(exact.binding.roomId, "room-a1");

  const switched = resolveBinding(state, { ...context, branch: "b1" });
  assert.equal(switched.kind, "bound");
  assert.equal(switched.source, "workspace");
  assert.equal(switched.binding.roomId, "default-room");

  const detached = resolveBinding(state, { ...context, branch: null });
  assert.equal(detached.kind, "bound");
  assert.equal(detached.source, "workspace");

  const removedExact = removeBinding(
    state,
    context.workspaceKey,
    "branch",
    "a1",
  );
  assert.equal(removedExact.removed, 1);
  assert.equal(requireBound(removedExact.state, context).source, "workspace");

  const removedDefault = removeBinding(
    removedExact.state,
    context.workspaceKey,
    "workspace",
  );
  assert.equal(removedDefault.removed, 1);
  assert.deepEqual(resolveBinding(removedDefault.state, context), {
    kind: "unbound",
    code: "CONTEXT_NOT_BOUND",
  });
});

test("many workspace and branch contexts can point to one room", () => {
  const first: GitWorkspaceContext = {
    workspaceRoot: "/code/backend",
    workspaceKey: "linux:/code/backend",
    branch: "feature/checkout",
  };
  const second: GitWorkspaceContext = {
    workspaceRoot: "/code/frontend",
    workspaceKey: "linux:/code/frontend",
    branch: "feature/checkout-ui",
  };
  let state = emptyBindingState();
  state = addBinding(state, branchInput(first, first.branch!, "checkout"), {
    now,
  }).state;
  state = addBinding(state, branchInput(second, second.branch!, "checkout"), {
    now,
  }).state;

  assert.equal(state.bindings.length, 2);
  assert.equal(requireBound(state, first).binding.roomId, "checkout");
  assert.equal(requireBound(state, second).binding.roomId, "checkout");
});

test("duplicate bindings require force and local state saves atomically", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-bindings-"));
  const stateFile = resolve(root, ".AgentForum", "state", "context-bindings.json");
  const context: GitWorkspaceContext = {
    workspaceRoot: "C:\\code\\shop",
    workspaceKey: "win32:c:/code/shop",
    branch: "a1",
  };

  try {
    const initial = addBinding(
      emptyBindingState(),
      branchInput(context, "a1", "room-a"),
      {
        now,
        bindingId: "binding_33333333-3333-3333-3333-333333333333",
      },
    );
    assert.throws(
      () => addBinding(initial.state, branchInput(context, "a1", "room-b")),
      (error) =>
        error instanceof ContextExperimentError && error.code === "BINDING_EXISTS",
    );

    const updated = addBinding(
      initial.state,
      branchInput(context, "a1", "room-b"),
      { force: true, now: "2026-07-12T17:01:00.000Z" },
    );
    assert.equal(updated.binding.bindingId, initial.binding.bindingId);
    assert.equal(updated.binding.createdAt, initial.binding.createdAt);
    assert.equal(updated.binding.roomId, "room-b");

    await saveBindingState(stateFile, initial.state);
    await saveBindingState(stateFile, updated.state);
    assert.deepEqual(await loadBindingState(stateFile), updated.state);
    assert.deepEqual(
      await loadBindingState(resolve(root, "missing.json")),
      emptyBindingState(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normal clones, linked worktrees, branch switches, and detached HEAD resolve safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-workspace-"));
  const repository = resolve(root, "repository");
  const linked = resolve(root, "linked");

  try {
    requireGit(root, ["init", "--initial-branch=main", repository]);
    configureExperimentIdentity(repository, "workspace-test");
    await writeFile(resolve(repository, "README.md"), "test\n", "utf8");
    requireGit(repository, ["add", "README.md"]);
    requireGit(repository, ["commit", "-m", "Initial commit"]);
    requireGit(repository, [
      "remote",
      "add",
      "origin",
      "https://secret-token@example.com/team/shop.git",
    ]);
    requireGit(repository, ["switch", "-c", "a1"]);

    const a1 = await discoverGitWorkspace(repository);
    assert.equal(a1.branch, "a1");
    assert.equal(a1.repositoryFingerprint, "example.com/team/shop");

    let state = emptyBindingState();
    state = addBinding(state, workspaceInput(a1, "workspace-default"), {
      now,
    }).state;
    state = addBinding(state, branchInput(a1, "a1", "room-a1"), { now }).state;
    assert.equal(requireBound(state, a1).binding.roomId, "room-a1");

    requireGit(repository, ["switch", "-c", "b1"]);
    const b1 = await discoverGitWorkspace(resolve(repository, "."));
    assert.equal(b1.workspaceKey, a1.workspaceKey);
    assert.equal(requireBound(state, b1).binding.roomId, "workspace-default");

    requireGit(repository, ["checkout", "--detach"]);
    const detached = await discoverGitWorkspace(repository);
    assert.equal(detached.branch, null);
    assert.equal(
      requireBound(state, detached).binding.roomId,
      "workspace-default",
    );

    requireGit(repository, ["switch", "a1"]);
    requireGit(repository, ["worktree", "add", "-b", "linked-feature", linked, "main"]);
    const linkedContext = await discoverGitWorkspace(linked);
    assert.equal(linkedContext.branch, "linked-feature");
    assert.notEqual(linkedContext.workspaceKey, a1.workspaceKey);

    state = addBinding(
      state,
      branchInput(linkedContext, "linked-feature", "room-a1"),
      { now },
    ).state;
    assert.equal(
      requireBound(state, linkedContext).binding.roomId,
      "room-a1",
    );
    assert.equal(
      state.bindings.filter((binding) => binding.roomId === "room-a1").length,
      2,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("non-Git directories are rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-not-git-"));
  try {
    await assert.rejects(
      discoverGitWorkspace(root),
      (error) =>
        error instanceof ContextExperimentError &&
        error.code === "GIT_WORKSPACE_REQUIRED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
