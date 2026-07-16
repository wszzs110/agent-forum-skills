import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  createLocalIdentity,
  loadLocalConfig,
  updateLocalIdentity,
} from "../src/config/local-config.js";
import { StateTransitionError } from "../src/domain/state-transitions.js";
import { requireGit } from "../src/git/runner.js";
import {
  createForumEvent,
  leaveForum,
  showForum,
} from "../src/services/forum-lifecycle.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const memberA = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const memberB = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const createdAt = new Date("2026-07-12T10:20:30.123Z");

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
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

test("local identities update fields, clear clients, and change the default", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-identity-update-"));
  try {
    const { paths } = await setup(home);
    await createLocalIdentity(
      {
        memberId: memberB,
        displayName: "Frontend B",
        role: "frontend",
        responsibility: "Checkout UI",
        client: "codex",
        setDefault: false,
        now: createdAt,
      },
      paths,
    );
    const updated = await updateLocalIdentity(
      {
        memberId: memberB,
        displayName: "Full Stack B",
        role: "full-stack",
        responsibility: "Checkout integration",
        client: null,
        setDefault: true,
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    assert.equal(updated.defaultIdentityId, memberB);
    assert.equal(updated.identity.displayName, "Full Stack B");
    assert.equal("client" in updated.identity, false);
    const config = await loadLocalConfig(paths);
    assert.equal(config.defaultIdentityId, memberB);
    assert.equal(config.identities.find((item) => item.memberId === memberB)?.createdAt, createdAt.toISOString());
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Forum lifecycle events derive current metadata without replacing forum.json", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-lifecycle-"));
  try {
    const { paths, forum } = await setup(home);
    const baseBefore = await readFile(resolve(forum.path, ".forum", "forum.json"), "utf8");
    await createForumEvent(
      {
        forumAlias: "a-team",
        type: "forum-renamed",
        reason: "Team scope expanded.",
        data: { name: "Platform Team" },
        now: new Date("2026-07-12T10:21:00.000Z"),
      },
      paths,
    );
    await createForumEvent(
      {
        forumAlias: "a-team",
        type: "forum-description-changed",
        reason: "Clarify responsibilities.",
        data: { description: "Platform engineering collaboration" },
        now: new Date("2026-07-12T10:22:00.000Z"),
      },
      paths,
    );
    await createForumEvent(
      {
        forumAlias: "a-team",
        type: "forum-archived",
        reason: "Work is paused.",
        data: {},
        now: new Date("2026-07-12T10:23:00.000Z"),
      },
      paths,
    );
    await assert.rejects(
      createForumEvent(
        {
          forumAlias: "a-team",
          type: "forum-archived",
          reason: "Duplicate archive.",
          data: {},
        },
        paths,
      ),
      (error) =>
        error instanceof StateTransitionError &&
        error.code === "INVALID_STATE_TRANSITION",
    );
    const restored = await createForumEvent(
      {
        forumAlias: "a-team",
        type: "forum-restored",
        reason: "Work resumed.",
        data: {},
        now: new Date("2026-07-12T10:24:00.000Z"),
      },
      paths,
    );
    assert.equal(restored.forum.name, "Platform Team");
    assert.equal(restored.forum.description, "Platform engineering collaboration");
    assert.equal(restored.forum.status, "active");
    assert.equal((await showForum("a-team", paths)).warnings.length, 0);
    assert.equal(await readFile(resolve(forum.path, ".forum", "forum.json"), "utf8"), baseBefore);
    assert.equal(requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(), "5");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Forum members leave without deleting history and publish can reactivate them", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-member-leave-"));
  try {
    const { paths, forum } = await setup(home);
    const left = await leaveForum("a-team", memberA, paths, new Date("2026-07-12T10:21:00.000Z"));
    assert.equal(left.memberId, memberA);
    const profilePath = resolve(forum.path, "members", memberA, "profile.json");
    assert.equal(JSON.parse(await readFile(profilePath, "utf8")).status, "left");
    const rejoined = await publishIdentity(
      "a-team",
      memberA,
      paths,
      new Date("2026-07-12T10:22:00.000Z"),
    );
    assert.equal(rejoined.action, "published");
    assert.equal(JSON.parse(await readFile(profilePath, "utf8")).status, "active");
    assert.equal(requireGit(forum.path, ["rev-list", "--count", "HEAD"]).stdout.trim(), "3");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
