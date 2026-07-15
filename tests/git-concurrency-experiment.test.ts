import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  GitExperimentError,
  commitPaths,
  configureExperimentIdentity,
  pushWithRebaseRetry,
  requireGit,
} from "../experiments/phase-0/git.js";
import {
  DRAFT_VERSION,
  initializeForumLayout,
  writeImmutableMessage,
  type MessageMetadata,
} from "../experiments/phase-0/protocol.js";

const roomId = "checkout";
const threadId = "checkout-api";

function message(
  id: string,
  authorId: string,
  type: "question" | "answer" | "change",
): MessageMetadata {
  return {
    schemaVersion: DRAFT_VERSION,
    id,
    threadId,
    authorId,
    type,
    createdAt: "2026-07-12T16:00:00.000Z",
    mentions: [],
    references: [{ kind: "branch", value: "feature/checkout" }],
  };
}

function messagePath(id: string): string {
  return `rooms/${roomId}/threads/${threadId}/messages/${id}`;
}

test("unique messages converge while shared metadata conflicts remain explicit", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-git-"));
  const remote = resolve(root, "forum.git");
  const agentA = resolve(root, "agent-a");
  const agentB = resolve(root, "agent-b");
  const verifier = resolve(root, "verifier");

  try {
    requireGit(root, ["init", "--bare", "--initial-branch=main", remote]);
    requireGit(root, ["-c", "core.autocrlf=false", "clone", remote, agentA]);
    configureExperimentIdentity(agentA, "agent-a");
    await initializeForumLayout(agentA, {
      forumId: "a-team",
      roomId,
      threadId,
      createdAt: "2026-07-12T16:00:00.000Z",
    });
    commitPaths(
      agentA,
      [".gitattributes", ".forum", "rooms"],
      "Initialize experimental forum",
    );
    requireGit(agentA, ["push", "--set-upstream", "origin", "main"]);

    requireGit(root, ["-c", "core.autocrlf=false", "clone", remote, agentB]);
    configureExperimentIdentity(agentB, "agent-b");

    const messageA = message(
      "msg_20260712T160001000Z_aaaaaaaaaaaa",
      "backend-a",
      "change",
    );
    const messageB = message(
      "msg_20260712T160002000Z_bbbbbbbbbbbb",
      "frontend-b",
      "question",
    );
    await writeImmutableMessage(agentA, roomId, messageA, "API changed.\n");
    await writeImmutableMessage(agentB, roomId, messageB, "Is it compatible?\n");
    commitPaths(agentA, [messagePath(messageA.id)], "Post backend change");
    commitPaths(agentB, [messagePath(messageB.id)], "Post frontend question");

    requireGit(agentA, ["push", "origin", "main"]);
    const retry = pushWithRebaseRetry(agentB);
    assert.equal(retry.kind, "pushed", JSON.stringify(retry));
    assert.equal(retry.attempts, 2);

    requireGit(root, ["-c", "core.autocrlf=false", "clone", remote, verifier]);
    assert.equal(
      await readFile(resolve(verifier, messagePath(messageA.id), "body.md"), "utf8"),
      "API changed.\n",
    );
    assert.equal(
      await readFile(resolve(verifier, messagePath(messageB.id), "body.md"), "utf8"),
      "Is it compatible?\n",
    );

    requireGit(agentA, ["pull", "--ff-only", "origin", "main"]);
    const roomFileA = resolve(agentA, "rooms", roomId, "room.json");
    const roomFileB = resolve(agentB, "rooms", roomId, "room.json");
    const roomA = JSON.parse(await readFile(roomFileA, "utf8"));
    const roomB = JSON.parse(await readFile(roomFileB, "utf8"));
    await writeFile(
      roomFileA,
      `${JSON.stringify({ ...roomA, title: "Checkout by A" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      roomFileB,
      `${JSON.stringify({ ...roomB, title: "Checkout by B" }, null, 2)}\n`,
      "utf8",
    );
    commitPaths(agentA, [`rooms/${roomId}/room.json`], "Rename room from A");
    const localCommitB = commitPaths(
      agentB,
      [`rooms/${roomId}/room.json`],
      "Rename room from B",
    );
    requireGit(agentA, ["push", "origin", "main"]);

    const conflict = pushWithRebaseRetry(agentB);
    assert.deepEqual(conflict, {
      kind: "conflict",
      attempts: 1,
      files: [`rooms/${roomId}/room.json`],
    });
    assert.equal(
      requireGit(agentB, ["rev-parse", "HEAD"]).stdout.trim(),
      localCommitB,
      "rebase abort must preserve the unpublished local commit",
    );
    assert.equal(
      JSON.parse(await readFile(roomFileB, "utf8")).title,
      "Checkout by B",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a non-retryable push failure preserves the local message commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-failure-"));
  const remote = resolve(root, "forum.git");
  const agent = resolve(root, "agent");

  try {
    requireGit(root, ["init", "--bare", "--initial-branch=main", remote]);
    requireGit(root, ["-c", "core.autocrlf=false", "clone", remote, agent]);
    configureExperimentIdentity(agent, "agent-c");
    await initializeForumLayout(agent, {
      forumId: "a-team",
      roomId,
      threadId,
      createdAt: "2026-07-12T16:00:00.000Z",
    });
    commitPaths(
      agent,
      [".gitattributes", ".forum", "rooms"],
      "Initialize forum with local post",
    );
    const headBefore = requireGit(agent, ["rev-parse", "HEAD"]).stdout.trim();
    requireGit(agent, [
      "remote",
      "set-url",
      "origin",
      resolve(root, "missing-remote.git"),
    ]);

    assert.throws(
      () => pushWithRebaseRetry(agent),
      (error) =>
        error instanceof GitExperimentError && error.code === "PUSH_FAILED",
    );
    assert.equal(
      requireGit(agent, ["rev-parse", "HEAD"]).stdout.trim(),
      headBefore,
    );
    assert.equal(
      requireGit(agent, ["status", "--porcelain"]).stdout,
      "",
      "the unpublished commit must remain intact and the worktree clean",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
