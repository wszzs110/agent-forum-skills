import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { attachDashboardClient, dashboardStatus, detachDashboardClient, getDashboardSnapshot, setDashboardForumPolling, setDashboardRoomPinned } from "../src/services/dashboard.js";
import { publishIdentity, initLocalForum } from "../src/services/local-forum.js";
import { createRoom, joinRoom } from "../src/services/room.js";
import { createPost, createThread } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const author = "member_0194f6d2-8c10-7a31-9e42-123456789ac1";
const reader = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789abc";
const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
const threadId = "thread_0194f6d2-8c10-7a31-9e42-123456789abe";

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  const now = new Date("2026-07-12T10:00:00.000Z");
  await createLocalIdentity({ memberId: author, displayName: "Author", role: "backend", responsibility: "API", now }, paths);
  await initLocalForum({ alias: "team", name: "Team", description: "Dashboard", forumId, now }, paths);
  await createLocalIdentity({ memberId: reader, displayName: "Reader", role: "frontend", responsibility: "UI", setDefault: false, now }, paths);
  await publishIdentity("team", reader, paths, now);
  await createRoom({ forumAlias: "team", slug: "checkout", title: "Checkout", description: "Room", roomId, now }, paths);
  await joinRoom({ forumAlias: "team", room: roomId, identityId: reader, now }, paths);
  await createThread({ forumAlias: "team", room: roomId, title: "Contract", kind: "proposal", body: "Initial", threadId, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789abf", now }, paths);
  await createPost({ forumAlias: "team", room: roomId, thread: threadId, type: "decision", body: "Broadcast", broadcast: true, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789ad0", now: new Date("2026-07-12T10:01:00.000Z") }, paths);
  return paths;
}

test("Dashboard leases aggregate Team snapshots and broadcast counts locally", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-"));
  try {
    const paths = await setup(home);
    for (let index = 0; index < 6; index += 1) await createRoom({ forumAlias: "team", slug: `extra-${index}`, title: `Extra Room ${index}`, description: "Dashboard expansion test", roomId: `room_0194f6d2-8c10-7a31-9e42-123456789b${String(20 + index).padStart(2, "0")}`, now: new Date("2026-07-12T10:02:00.000Z") }, paths);
    const attached = await attachDashboardClient({ clientId: "pi-session-1", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);
    assert.equal(attached.activeClients, 1);
    const attachedRevision = (await dashboardStatus(paths)).revision;
    await attachDashboardClient({ clientId: "pi-session-1", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);
    assert.equal((await dashboardStatus(paths)).revision, attachedRevision, "heartbeat-only renewal must not invalidate the snapshot");
    await setDashboardRoomPinned(roomId, true, paths);
    await setDashboardForumPolling(forumId, true, paths);
    const snapshot = await getDashboardSnapshot(paths);
    assert.equal(snapshot.activeClients, 1);
    assert.equal(snapshot.teams.length, 1);
    assert.equal(snapshot.teams[0]?.polling, true);
    assert.equal(snapshot.teams[0]?.rooms[0]?.activeLocalAgents, 1);
    assert.equal(snapshot.teams[0]?.rooms[0]?.pinned, true);
    assert.ok(snapshot.revision > attachedRevision);
    assert.equal(snapshot.teams[0]?.rooms[0]?.counts.broadcast, 1);
    assert.equal(snapshot.teams[0]?.rooms.length, 7, "Dashboard snapshots retain all rooms for the expanded UI");
    assert.deepEqual(await detachDashboardClient("pi-session-1", paths), { detached: true, activeClients: 0 });
    assert.equal((await dashboardStatus(paths)).clients.length, 0);
  } finally { await rm(home, { recursive: true, force: true }); }
});
