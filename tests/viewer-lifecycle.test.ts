import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { initLocalForum, publishIdentity } from "../src/services/local-forum.js";
import { getInbox } from "../src/services/inbox.js";
import { createRoom, joinRoom } from "../src/services/room.js";
import { createThread, createThreadEvent } from "../src/services/thread.js";
import { setRoomPublishMode } from "../src/services/publish-policy.js";
import { closeViewerSession, generateViewerHtml, getViewerRoomData, listViewerSessions, openViewer, viewerServerLaunchArgs } from "../src/services/viewer.js";
import { createAgentForumPaths } from "../src/storage/paths.js";
import { requireGit } from "../src/git/runner.js";
import { bindContext } from "../src/services/context.js";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  const now = new Date("2026-07-12T12:00:00.000Z");
  await createLocalIdentity({ memberId: "member_0194f6d2-8c10-7a31-9e42-123456789ac1", displayName: "Viewer Agent", role: "review", responsibility: "Audit", now }, paths);
  await initLocalForum({ alias: "team", name: "Team", description: "Viewer", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc", now }, paths);
  const readerId = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
  await createLocalIdentity({ memberId: readerId, displayName: "Reader Agent", role: "frontend", responsibility: "Read", setDefault: false, now }, paths);
  await publishIdentity("team", readerId, paths, now);
  await createRoom({ forumAlias: "team", slug: "review", title: "Review", description: "Human review", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789abd", now }, paths);
  await joinRoom({ forumAlias: "team", room: "review", identityId: readerId, now }, paths);
  await createThread({ forumAlias: "team", room: "review", title: "Audit this", kind: "review", body: "## Visible marker 你好\n\n**Bold** and <script>unsafe</script>", threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789abe", now: new Date("2026-07-12T12:00:01.000Z") }, paths);
  return paths;
}

test("自包含 CLI 启动 Viewer 时不将自身可执行文件误传为子命令", () => {
  const command = ["viewer", "serve", "--forum", "team"];
  assert.deepEqual(viewerServerLaunchArgs("/tmp/agent-forum-dashboard-cli", command, "/tmp/agent-forum-dashboard-cli"), command);
  assert.deepEqual(viewerServerLaunchArgs("/tmp/agent-forum.mjs", command, "/usr/bin/node"), ["/tmp/agent-forum.mjs", ...command]);
});

test("Viewer data returns active Room members and deterministic activity data", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-data-"));
  try {
    const paths = await setup(home);
    await createThreadEvent({ forumAlias: "team", room: "review", thread: "thread_0194f6d2-8c10-7a31-9e42-123456789abe", type: "thread-closed", reason: "Review completed.", data: {}, now: new Date("2026-07-12T12:01:00.000Z") }, paths);
    const data = await getViewerRoomData({ forumAlias: "team", room: "review" }, paths);
    assert.equal(data.room.title, "Review");
    assert.equal(data.room.sendMode, "auto");
    assert.equal(data.stats.threadCount, 1);
    assert.equal(data.stats.messageCount, 1);
    assert.equal(data.stats.memberCount, 2);
    assert.equal(data.members[0]?.displayName, "Viewer Agent");
    assert.equal(data.members[0]?.messageCount, 1);
    assert.equal(data.threads[0]?.status, "closed");
    assert.equal(data.threads[0]?.messages[0]?.body, "## Visible marker 你好\n\n**Bold** and <script>unsafe</script>");
    assert.match(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<h4>Visible marker 你好<\/h4>/);
    assert.match(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<strong>Bold<\/strong>/);
    assert.doesNotMatch(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<script>/);
    assert.equal(data.threads[0]?.messages[0]?.localReceipt.publishedBy[0]?.displayName, "Viewer Agent");
    assert.equal(data.threads[0]?.messages[0]?.localReceipt.readBy.length, 0);
    assert.equal(data.threads[0]?.messages[0]?.localReceipt.unreadBy.length, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Viewer data exposes the Room send mode from the local publish policy", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-sendmode-"));
  try {
    const paths = await setup(home);
    const roomId = "room_0194f6d2-8c10-7a31-9e42-123456789abd";
    await setRoomPublishMode(paths, { forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc", roomId, mode: "ask", now: new Date("2026-07-12T12:02:00.000Z") });
    const asked = await getViewerRoomData({ forumAlias: "team", room: "review" }, paths);
    assert.equal(asked.room.sendMode, "ask");
    const output = resolve(paths.viewerDirectory, "sendmode-export.html");
    const result = await generateViewerHtml({ forumAlias: "team", room: "review", output }, paths);
    const html = await readFile(result.output, "utf8");
    assert.match(html, /class="send-mode ask"/u, "static Viewer export marks the Room as approval-required");
    assert.match(html, /先问再发/u, "static Viewer export carries the Chinese ask-before-sending label");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Viewer data derives AI unread and read receipts from the private cursor", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-receipt-"));
  const readerId = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
  try {
    const paths = await setup(home);
    const before = await getViewerRoomData({ forumAlias: "team", room: "review", identityIds: [readerId] }, paths);
    assert.equal(before.threads[0]?.messages[0]?.localReceipt.unreadBy[0]?.displayName, "Reader Agent");
    assert.equal(before.threads[0]?.messages[0]?.localReceipt.readBy.length, 0);
    await createThreadEvent({ forumAlias: "team", room: "review", thread: "thread_0194f6d2-8c10-7a31-9e42-123456789abe", type: "thread-closed", reason: "Done", data: {}, now: new Date("2026-07-12T12:02:00.000Z") }, paths);
    const closed = await getViewerRoomData({ forumAlias: "team", room: "review", identityIds: [readerId] }, paths);
    assert.equal(closed.threads[0]?.status, "closed");
    assert.equal(closed.threads[0]?.messages[0]?.localReceipt.unreadBy.length, 0, "closed Thread messages are not Dashboard navigation targets");
    await getInbox({ forumAlias: "team", identityId: readerId, sync: false, markAllRead: true }, paths);
    const after = await getViewerRoomData({ forumAlias: "team", room: "review", identityIds: [readerId] }, paths);
    assert.equal(after.threads[0]?.messages[0]?.localReceipt.readBy[0]?.displayName, "Reader Agent");
    assert.equal(after.threads[0]?.messages[0]?.localReceipt.unreadBy.length, 0);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Viewer launcher becomes ready, reports status, and closes without blocking", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-launch-"));
  try {
    const paths = await setup(home);
    const opened = await openViewer({ forumAlias: "team", room: "review", openBrowser: false, idleMs: 30_000, entryPath: resolve("skills", "agent-forum", "scripts", "agent-forum.mjs") }, paths);
    assert.equal(opened.url.startsWith("http://127.0.0.1:"), true);
    assert.equal(opened.browserOpened, false);
    const response = await fetch(opened.url);
    assert.equal(response.status, 200);
    assert.equal((await response.text()).includes("Visible marker 你好"), true);
    assert.equal((await listViewerSessions(paths)).length, 1);

    const replacement = await openViewer({ forumAlias: "team", room: "review", openBrowser: false, idleMs: 30_000, entryPath: resolve("skills", "agent-forum", "scripts", "agent-forum.mjs") }, paths);
    assert.notEqual(replacement.sessionId, opened.sessionId);
    assert.deepEqual(replacement.replacedSessionIds, [opened.sessionId]);
    assert.equal(isProcessAlive(opened.pid), false, "replacement waits for the old Viewer process to exit");
    const sessions = await listViewerSessions(paths);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.sessionId, replacement.sessionId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    await assert.rejects(fetch(opened.url));

    assert.deepEqual((await closeViewerSession(replacement.sessionId, paths)).closed, [replacement.sessionId]);
    assert.equal(isProcessAlive(replacement.pid), false, "close waits for the Viewer process to exit");
    assert.equal((await listViewerSessions(paths)).length, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Viewer opened from a binding displays its workspace and branch", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-binding-"));
  try {
    const paths = await setup(home);
    const workspace = resolve(home, "workspace");
    requireGit(home, ["init", "--initial-branch=main", workspace]);
    requireGit(workspace, ["config", "user.name", "Viewer binding test"]);
    requireGit(workspace, ["config", "user.email", "viewer-binding@example.invalid"]);
    await writeFile(resolve(workspace, "README.md"), "binding test\n", "utf8");
    requireGit(workspace, ["add", "README.md"]);
    requireGit(workspace, ["commit", "-m", "Initial commit"]);
    await bindContext({ forumAlias: "team", room: "review", cwd: workspace }, paths);

    const opened = await openViewer({ cwd: workspace, openBrowser: false, idleMs: 30_000, entryPath: resolve("skills", "agent-forum", "scripts", "agent-forum.mjs") }, paths);
    try {
      const html = await (await fetch(opened.url)).text();
      assert.match(html, /class="binding-context"/u);
      assert.equal(html.includes(workspace), true);
      assert.match(html, />main<\/code>/u);
    } finally {
      await closeViewerSession(opened.sessionId, paths);
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Viewer static export is self-contained and does not mutate the Forum", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-export-"));
  try {
    const paths = await setup(home);
    const output = resolve(home, "review.html");
    const result = await generateViewerHtml({ forumAlias: "team", room: "review", output }, paths);
    assert.equal(result.output, output);
    await access(output);
    const html = await readFile(output, "utf8");
    assert.equal(html.includes("Visible marker 你好"), true);
    assert.equal(html.includes("https://"), false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
