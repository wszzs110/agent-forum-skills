import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli } from "../src/cli.js";
import { dashboardUpdateAvailable } from "../src/commands/dashboard.js";
import { attachDashboardClient, dashboardStatus, detachDashboardClient, getDashboardSnapshot, setDashboardForumPolling, setDashboardRoomPinned } from "../src/services/dashboard.js";
import { publishIdentity, initLocalForum } from "../src/services/local-forum.js";
import { createRoom, createRoomEvent, joinRoom } from "../src/services/room.js";
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

test("Dashboard reports only an independent Desktop update", () => {
  assert.equal(dashboardUpdateAvailable("0.0.10", "0.0.10"), false, "an npm-only upgrade must not download Dashboard assets");
  assert.equal(dashboardUpdateAvailable("0.0.10", "0.0.11"), true);
  assert.equal(dashboardUpdateAvailable(undefined, "0.0.10"), true);
});

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
    const otherBeforeOwnPost = snapshot.teams[0]?.rooms[0]?.counts.other ?? 0;
    await createPost({ forumAlias: "team", room: roomId, thread: threadId, identityId: reader, type: "status", body: "Posted while Dashboard is open", messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789ad2", now: new Date(Date.now() + 1_000) }, paths);
    const afterOwnPost = await getDashboardSnapshot(paths);
    assert.equal(afterOwnPost.teams[0]?.rooms[0]?.counts.other, otherBeforeOwnPost + 1, "own posts created during the Dashboard session are included with other activity");
    assert.equal(afterOwnPost.teams[0]?.counts.other, otherBeforeOwnPost + 1);
    assert.equal(snapshot.teams[0]?.rooms.length, 7, "Dashboard snapshots retain all rooms for the expanded UI");
    assert.deepEqual(await detachDashboardClient("pi-session-1", paths), { detached: true, activeClients: 0 });
    assert.equal((await dashboardStatus(paths)).clients.length, 0);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Dashboard snapshots mark deprecated Rooms and always sort them last", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-deprecated-"));
  try {
    const paths = await setup(home);
    const deprecatedRoomId = "room_0194f6d2-8c10-7a31-9e42-123456789b20";
    await createRoom({ forumAlias: "team", slug: "old-checkout", title: "Old Checkout", description: "Superseded", roomId: deprecatedRoomId, now: new Date("2026-07-12T10:02:00.000Z") }, paths);
    await createRoomEvent({ forumAlias: "team", room: deprecatedRoomId, type: "room-deprecated", reason: "Use Checkout", data: {}, now: new Date("2026-07-12T10:03:00.000Z") }, paths);
    await attachDashboardClient({ clientId: "pi-session-1", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);
    const rooms = (await getDashboardSnapshot(paths)).teams[0]!.rooms;
    assert.equal(rooms.at(-1)?.roomId, deprecatedRoomId);
    assert.equal(rooms.at(-1)?.deprecated, true);
    assert.equal(rooms[0]?.deprecated, false);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("CLI posts invalidate the active Dashboard and expose the author activity immediately", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-cli-refresh-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    await attachDashboardClient({ clientId: "pi-author", clientType: "pi", forumAlias: "team", roomId, identityId: author, leaseMs: 30_000 }, paths);
    const before = (await dashboardStatus(paths)).revision;
    const stdout: string[] = [];
    assert.equal(await runCli(["--json", "post", "create", "--forum", "team", "--room", roomId, "--thread", threadId, "--type", "status", "--body", "Visible immediately."], { stdout: (value) => stdout.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(stdout.join("")).ok, true);
    assert.ok((await dashboardStatus(paths)).revision > before, "successful CLI post must invalidate the active Dashboard runtime");
    assert.equal((await getDashboardSnapshot(paths)).teams[0]?.rooms[0]?.counts.other, 1);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});
