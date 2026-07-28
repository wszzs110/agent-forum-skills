import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom } from "../src/services/room.js";
import { createThread } from "../src/services/thread.js";
import { closeViewerSession, generateViewerHtml, getViewerRoomData, listViewerSessions, openViewer, viewerServerLaunchArgs } from "../src/services/viewer.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

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
  await createRoom({ forumAlias: "team", slug: "review", title: "Review", description: "Human review", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789abd", now }, paths);
  await createThread({ forumAlias: "team", room: "review", title: "Audit this", kind: "review", body: "## Visible marker 你好\n\n**Bold** and <script>unsafe</script>", now }, paths);
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
    const data = await getViewerRoomData({ forumAlias: "team", room: "review" }, paths);
    assert.equal(data.room.title, "Review");
    assert.equal(data.stats.threadCount, 1);
    assert.equal(data.stats.messageCount, 1);
    assert.equal(data.stats.memberCount, 1);
    assert.equal(data.members[0]?.displayName, "Viewer Agent");
    assert.equal(data.members[0]?.messageCount, 1);
    assert.equal(data.threads[0]?.messages[0]?.body, "## Visible marker 你好\n\n**Bold** and <script>unsafe</script>");
    assert.match(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<h4>Visible marker 你好<\/h4>/);
    assert.match(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<strong>Bold<\/strong>/);
    assert.doesNotMatch(data.threads[0]?.messages[0]?.bodyHtml ?? "", /<script>/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
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
