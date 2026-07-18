import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { initLocalForum } from "../src/services/local-forum.js";
import { createRoom } from "../src/services/room.js";
import { createThread } from "../src/services/thread.js";
import { closeViewerSession, generateViewerHtml, listViewerSessions, openViewer } from "../src/services/viewer.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

async function setup(home: string) {
  const paths = createAgentForumPaths(home);
  const now = new Date("2026-07-12T12:00:00.000Z");
  await createLocalIdentity({ memberId: "member_0194f6d2-8c10-7a31-9e42-123456789ac1", displayName: "Viewer Agent", role: "review", responsibility: "Audit", now }, paths);
  await initLocalForum({ alias: "team", name: "Team", description: "Viewer", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc", now }, paths);
  await createRoom({ forumAlias: "team", slug: "review", title: "Review", description: "Human review", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789abd", now }, paths);
  await createThread({ forumAlias: "team", room: "review", title: "Audit this", kind: "review", body: "Visible marker 你好", now }, paths);
  return paths;
}

test("Viewer launcher becomes ready, reports status, and closes without blocking", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-viewer-launch-"));
  try {
    const paths = await setup(home);
    const opened = await openViewer({ forumAlias: "team", room: "review", sync: false, openBrowser: false, idleMs: 30_000, entryPath: resolve("skills", "agent-forum", "scripts", "agent-forum.mjs") }, paths);
    assert.equal(opened.url.startsWith("http://127.0.0.1:"), true);
    assert.equal(opened.browserOpened, false);
    const response = await fetch(opened.url);
    assert.equal(response.status, 200);
    assert.equal((await response.text()).includes("Visible marker 你好"), true);
    assert.equal((await listViewerSessions(paths)).length, 1);

    const replacement = await openViewer({ forumAlias: "team", room: "review", sync: false, openBrowser: false, idleMs: 30_000, entryPath: resolve("skills", "agent-forum", "scripts", "agent-forum.mjs") }, paths);
    assert.notEqual(replacement.sessionId, opened.sessionId);
    assert.deepEqual(replacement.replacedSessionIds, [opened.sessionId]);
    const sessions = await listViewerSessions(paths);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.sessionId, replacement.sessionId);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    await assert.rejects(fetch(opened.url));

    assert.deepEqual((await closeViewerSession(replacement.sessionId, paths)).closed, [replacement.sessionId]);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
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
