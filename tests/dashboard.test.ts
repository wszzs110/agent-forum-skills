import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli } from "../src/cli.js";
import { dashboardUpdateAvailable } from "../src/commands/dashboard.js";
import { attachDashboardClient, dashboardStatus, detachDashboardClient, getDashboardSnapshot, invalidateDashboard, setDashboardForumPolling, setDashboardRoomPinned } from "../src/services/dashboard.js";
import { publishIdentity, initLocalForum } from "../src/services/local-forum.js";
import { addRemoteForum, publishLocalForum } from "../src/services/forum-remote.js";
import { createRoom, createRoomEvent, joinRoom } from "../src/services/room.js";
import { createPost, createThread, createThreadEvent } from "../src/services/thread.js";
import { setRoomPublishMode } from "../src/services/publish-policy.js";
import { requireGit } from "../src/git/runner.js";
import { bindContext } from "../src/services/context.js";
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

test("Dashboard open reports a stable acquisition signal when no usable Desktop is available", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-unavailable-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    const paths = await setup(home);
    // 源码测试在非 Windows 会启用 Deno 开发回退；损坏安装确保本测试只验证生产 acquisition 错误契约。
    await mkdir(paths.dashboardInstallDirectory, { recursive: true });
    await writeFile(paths.dashboardInstallationFile, "{}\n");
    const stdout: string[] = [];
    assert.equal(await runCli(["--json", "dashboard", "open", "--client-id", "pi-test", "--client-type", "pi", "--forum", "team", "--room", roomId], { stdout: (text) => stdout.push(text), stderr: () => undefined }), 1);
    const result = JSON.parse(stdout.join(""));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "DASHBOARD_UNAVAILABLE");
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

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
    assert.equal(afterOwnPost.teams[0]?.rooms[0]?.counts.other, otherBeforeOwnPost, "own posts are not mixed into unread counters");
    assert.equal(afterOwnPost.teams[0]?.counts.other, otherBeforeOwnPost);
    await createThreadEvent({ forumAlias: "team", room: roomId, thread: threadId, type: "thread-closed", reason: "Done", data: {}, now: new Date(Date.now() + 2_000) }, paths);
    const afterClose = await getDashboardSnapshot(paths);
    assert.deepEqual(afterClose.teams[0]?.rooms[0]?.counts, { related: 0, broadcast: 0, other: 0 }, "all unread entries in a closed Thread are excluded from Dashboard counters");
    assert.deepEqual(afterClose.teams[0]?.counts, { related: 0, broadcast: 0, other: 0 });
    assert.equal(snapshot.teams[0]?.rooms.length, 7, "Dashboard snapshots retain all rooms for the expanded UI");
    assert.deepEqual(await detachDashboardClient("pi-session-1", paths), { detached: true, activeClients: 0 });
    assert.equal((await dashboardStatus(paths)).clients.length, 0);
    const detachedRevision = (await dashboardStatus(paths)).revision;
    await invalidateDashboard(paths);
    assert.ok((await dashboardStatus(paths)).revision > detachedRevision, "visible Dashboard invalidates even without an active Agent lease");
    const detachedSnapshot = await getDashboardSnapshot(paths);
    assert.equal(detachedSnapshot.activeClients, 0);
    assert.equal(detachedSnapshot.teams.length, 1, "Dashboard view targets survive the last Agent detach");
    assert.equal(detachedSnapshot.teams[0]?.rooms[0]?.activeLocalAgents, 0);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Dashboard snapshots expose matching local workspace bindings", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-bindings-"));
  const home = resolve(root, "home");
  try {
    const paths = await setup(home);
    const workspace = resolve(root, "bound-workspace");
    requireGit(root, ["init", "--initial-branch=feature/dashboard-binding", workspace]);
    requireGit(workspace, ["config", "user.name", "Dashboard binding test"]);
    requireGit(workspace, ["config", "user.email", "dashboard-binding@example.invalid"]);
    await writeFile(resolve(workspace, "README.md"), "dashboard binding\n", "utf8");
    requireGit(workspace, ["add", "README.md"]);
    requireGit(workspace, ["commit", "-m", "Initial binding test"]);

    await bindContext({ forumAlias: "team", room: roomId, cwd: workspace, now: new Date("2026-07-12T10:02:00.000Z") }, paths);
    await bindContext({ forumAlias: "team", room: roomId, cwd: workspace, workspace: true, now: new Date("2026-07-12T10:03:00.000Z") }, paths);
    await attachDashboardClient({ clientId: "pi-binding", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);

    const room = (await getDashboardSnapshot(paths)).teams[0]?.rooms.find((item) => item.roomId === roomId);
    // 产品侧用 fs/promises.realpath 规范化绑定目录；测试用同一函数对齐 Windows 8.3 短名与 macOS /private/var 展开差异。
    const normalizedWorkspace = await realpath(workspace);
    assert.deepEqual(room?.bindings, [
      { workspaceRoot: normalizedWorkspace, branch: null },
      { workspaceRoot: normalizedWorkspace, branch: "feature/dashboard-binding" },
    ]);
    assert.equal(room?.sendMode, "auto");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Dashboard snapshots expose per-room send mode and refresh on publish policy changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-sendmode-"));
  const home = resolve(root, "home");
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    await attachDashboardClient({ clientId: "pi-sendmode", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);

    const before = await dashboardStatus(paths);
    const setAsk: string[] = [];
    assert.equal(await runCli(["--json", "publish", "policy", "--mode", "ask", "--forum", "team", "--room", roomId], { stdout: (value) => setAsk.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(setAsk.join("")).ok, true);
    const asked = await getDashboardSnapshot(paths);
    assert.ok(asked.revision > before.revision, "publish policy change must invalidate the visible Dashboard");
    assert.equal(asked.teams[0]?.rooms.find((item) => item.roomId === roomId)?.sendMode, "ask");

    // 服务层直接设置其他房间不影响该房间；未设置房间保持默认 auto。
    await setRoomPublishMode(paths, { forumId, roomId: "room_0194f6d2-8c10-7a31-9e42-123456789b20", mode: "ask", now: new Date("2026-07-12T10:05:00.000Z") });
    assert.equal((await getDashboardSnapshot(paths)).teams[0]?.rooms.find((item) => item.roomId === roomId)?.sendMode, "ask");
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI context bind and unbind invalidate Dashboard binding markers", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-binding-refresh-"));
  const home = resolve(root, "home");
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    const workspace = resolve(root, "bound-workspace");
    requireGit(root, ["init", "--initial-branch=feature/dashboard-refresh", workspace]);
    requireGit(workspace, ["config", "user.name", "Dashboard binding refresh test"]);
    requireGit(workspace, ["config", "user.email", "dashboard-binding-refresh@example.invalid"]);
    await writeFile(resolve(workspace, "README.md"), "dashboard binding refresh\n", "utf8");
    requireGit(workspace, ["add", "README.md"]);
    requireGit(workspace, ["commit", "-m", "Initial binding refresh test"]);
    await attachDashboardClient({ clientId: "pi-binding-refresh", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);

    const before = await dashboardStatus(paths);
    const bindOutput: string[] = [];
    assert.equal(await runCli(["--json", "context", "bind", "--forum", "team", "--room", roomId, "--cwd", workspace], { stdout: (value) => bindOutput.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(bindOutput.join(""))?.ok, true);
    const bound = await getDashboardSnapshot(paths);
    assert.ok(bound.revision > before.revision, "context bind must invalidate the visible Dashboard");
    assert.equal(bound.teams[0]?.rooms.find((item) => item.roomId === roomId)?.bindings.length, 1);

    const unbindOutput: string[] = [];
    assert.equal(await runCli(["--json", "context", "unbind", "--cwd", workspace], { stdout: (value) => unbindOutput.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(unbindOutput.join(""))?.ok, true);
    const unbound = await getDashboardSnapshot(paths);
    assert.ok(unbound.revision > bound.revision, "context unbind must invalidate the visible Dashboard");
    assert.equal(unbound.teams[0]?.rooms.find((item) => item.roomId === roomId)?.bindings.length, 0);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await rm(root, { recursive: true, force: true });
  }
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

test("CLI posts invalidate the Dashboard without counting the author's post as unread", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-cli-refresh-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    await attachDashboardClient({ clientId: "pi-author", clientType: "pi", forumAlias: "team", roomId, identityId: author, leaseMs: 30_000 }, paths);
    const before = (await dashboardStatus(paths)).revision;
    const leaseOutput: string[] = [];
    assert.equal(await runCli(["--json", "dashboard", "lease-status"], { stdout: (value) => leaseOutput.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(leaseOutput.join("")).data.clients.length, 1);
    const stdout: string[] = [];
    assert.equal(await runCli(["--json", "post", "create", "--forum", "team", "--room", roomId, "--thread", threadId, "--type", "status", "--body", "Visible immediately."], { stdout: (value) => stdout.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(stdout.join("")).ok, true);
    assert.ok((await dashboardStatus(paths)).revision > before, "successful CLI post must invalidate the active Dashboard runtime");
    assert.equal((await getDashboardSnapshot(paths)).teams[0]?.rooms[0]?.counts.other, 0);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

test("CLI forum status 在无远端变更时不递增 Dashboard revision", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-status-refresh-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);
    await attachDashboardClient({ clientId: "pi-status", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, paths);
    const before = (await dashboardStatus(paths)).revision;
    const output: string[] = [];
    assert.equal(await runCli(["--json", "forum", "status", "--forum", "team"], { stdout: (value) => output.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(output.join("")).ok, true);
    assert.equal((await dashboardStatus(paths)).revision, before, "an unchanged read-only forum status must not force a Dashboard redraw");
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

test("CLI forum status 拉到远端更新时递增 Dashboard revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-status-remote-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    const sourcePaths = await setup(resolve(root, "source-home"));
    const remote = resolve(root, "forum.git");
    requireGit(root, ["init", "--bare", "--initial-branch=main", remote]);
    await publishLocalForum({ forumAlias: "team", remote }, sourcePaths);

    const targetHome = resolve(root, "target-home");
    const targetPaths = createAgentForumPaths(targetHome);
    await createLocalIdentity({ memberId: reader, displayName: "Reader", role: "frontend", responsibility: "UI", now: new Date("2026-07-12T10:03:00.000Z") }, targetPaths);
    await addRemoteForum({ alias: "team", remote, now: new Date("2026-07-12T10:04:00.000Z") }, targetPaths);
    await attachDashboardClient({ clientId: "pi-status-remote", clientType: "pi", forumAlias: "team", roomId, identityId: reader, leaseMs: 30_000 }, targetPaths);
    const before = (await dashboardStatus(targetPaths)).revision;

    await createPost({ forumAlias: "team", room: roomId, thread: threadId, type: "status", body: "Remote update", messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789ad3", now: new Date("2026-07-12T10:05:00.000Z") }, sourcePaths);
    process.env.HOME = targetHome;
    process.env.USERPROFILE = targetHome;
    const output: string[] = [];
    assert.equal(await runCli(["--json", "forum", "status", "--forum", "team"], { stdout: (value) => output.push(value), stderr: () => undefined }), 0);
    const result = JSON.parse(output.join(""));
    assert.equal(result.ok, true);
    assert.equal(result.data.freshness.refresh.outcome, "updated");
    assert.ok((await dashboardStatus(targetPaths)).revision > before, "a real remote update must refresh the Dashboard Bar after polling");
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await rm(root, { recursive: true, force: true });
  }
});
