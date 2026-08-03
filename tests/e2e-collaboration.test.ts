import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { requireGit } from "../src/git/runner.js";
import { addRemoteForum, publishLocalForum } from "../src/services/forum-remote.js";
import { syncForum } from "../src/services/forum-sync.js";
import { getInbox } from "../src/services/inbox.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import { createRoom, joinRoom } from "../src/services/room.js";
import { createPost, createThread, showThread } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const ids = [
  "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
  "member_0194f6d2-8c10-7a31-9e42-123456789ac2",
  "member_0194f6d2-8c10-7a31-9e42-123456789ac3",
  "member_0194f6d2-8c10-7a31-9e42-123456789ac4",
];

async function identity(home: string, index: number) {
  const paths = createAgentForumPaths(home);
  await createLocalIdentity({ memberId: ids[index]!, displayName: `Agent ${index + 1}`, role: index < 2 ? "backend" : "frontend", responsibility: index < 2 ? "API" : "UI" }, paths);
  return paths;
}

test("two backend and two frontend Agents complete a remote contract workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-four-agent-"));
  try {
    const owner = await identity(resolve(root, "owner"), 0);
    const initialized = await initLocalForum({ alias: "team", name: "Product Team", description: "Four-agent trial", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc", dataBranch: "forum-data" }, owner);
    const remote = resolve(root, "forum.git");
    requireGit(root, ["init", "--bare", "--initial-branch=forum-data", remote]);
    await publishLocalForum({ forumAlias: "team", remote }, owner);
    requireGit(remote, ["symbolic-ref", "HEAD", "refs/heads/forum-data"]);

    const agents = [owner];
    for (let index = 1; index < 4; index += 1) {
      const paths = await identity(resolve(root, `agent-${index + 1}`), index);
      const clone = await addRemoteForum({ alias: "team", remote }, paths);
      requireGit(clone.path, ["config", "user.name", `Agent ${index + 1}`]);
      requireGit(clone.path, ["config", "user.email", `agent${index + 1}@example.invalid`]);
      await publishIdentity("team", undefined, paths);
      await syncForum("team", paths);
      agents.push(paths);
    }
    await syncForum("team", owner);
    const room = await createRoom({ forumAlias: "team", slug: "contract", title: "API Contract", description: "Coordinate API and UI" }, owner);
    await syncForum("team", owner);
    for (const paths of agents.slice(1)) {
      await syncForum("team", paths);
      await joinRoom({ forumAlias: "team", room: room.room.id }, paths);
      await syncForum("team", paths);
    }
    await syncForum("team", owner);

    const proposal = await createThread({ forumAlias: "team", room: room.room.id, title: "Checkout response", kind: "proposal", body: "Return orderId and status." }, owner);
    await syncForum("team", owner);
    await syncForum("team", agents[2]!);
    assert.equal((await getInbox({ forumAlias: "team", all: true }, agents[2]!)).entries.some((entry) => entry.type === "proposal"), true);
    await createPost({ forumAlias: "team", room: room.room.id, thread: proposal.thread.id, type: "question", body: "Can status be a stable enum?" }, agents[2]!);
    await syncForum("team", agents[2]!);
    await syncForum("team", agents[1]!);
    await createPost({ forumAlias: "team", room: room.room.id, thread: proposal.thread.id, type: "answer", body: "Yes: pending, paid, failed." }, agents[1]!);
    await syncForum("team", agents[1]!);
    await syncForum("team", agents[3]!);
    await createPost({ forumAlias: "team", room: room.room.id, thread: proposal.thread.id, type: "acknowledgement", body: "Frontend accepts this contract." }, agents[3]!);
    await syncForum("team", agents[3]!);
    await syncForum("team", owner);
    const detail = await showThread("team", room.room.id, proposal.thread.id, owner);
    assert.deepEqual(detail.messages.map((message) => message.type), ["proposal", "question", "answer", "acknowledgement"]);
    assert.equal(initialized.forumId, "forum_0194f6d2-8c10-7a31-9e42-123456789abc");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
