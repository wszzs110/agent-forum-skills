import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLocalIdentity } from "../src/config/local-config.js";
import { runCli } from "../src/cli.js";
import { publishIdentity, initLocalForum } from "../src/services/local-forum.js";
import { createRoom, joinRoom } from "../src/services/room.js";
import { createPost, createThread } from "../src/services/thread.js";
import { getRoomPublishMode, loadPublishPolicy, setRoomPublishMode } from "../src/services/publish-policy.js";
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
  await initLocalForum({ alias: "team", name: "Team", description: "Publish policy", forumId, now }, paths);
  await createLocalIdentity({ memberId: reader, displayName: "Reader", role: "frontend", responsibility: "UI", setDefault: false, now }, paths);
  await publishIdentity("team", reader, paths, now);
  await createRoom({ forumAlias: "team", slug: "checkout", title: "Checkout", description: "Room", roomId, now }, paths);
  await joinRoom({ forumAlias: "team", room: roomId, identityId: reader, now }, paths);
  await createThread({ forumAlias: "team", room: roomId, title: "Contract", kind: "proposal", body: "Initial", threadId, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789abf", now }, paths);
  return paths;
}

test("publish policy persists per-room modes and defaults to auto", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-publish-policy-store-"));
  try {
    const paths = await setup(home);
    assert.equal(await getRoomPublishMode(paths, forumId, roomId), "auto");

    const first = await setRoomPublishMode(paths, { forumId, roomId, mode: "ask", now: new Date("2026-07-12T10:05:00.000Z") });
    assert.equal(first.entry.mode, "ask");
    assert.equal(await getRoomPublishMode(paths, forumId, roomId), "ask");
    assert.equal((await loadPublishPolicy(paths)).entries.length, 1);

    // 同房间重复设置即覆盖，不产生重复 entry。
    const second = await setRoomPublishMode(paths, { forumId, roomId, mode: "ask", now: new Date("2026-07-12T10:06:00.000Z") });
    assert.equal(second.state.entries.length, 1);
    assert.equal(second.entry.updatedAt, "2026-07-12T10:06:00.000Z");

    // 切回 auto 后仍保留显式 entry，但语义回退为默认。
    const auto = await setRoomPublishMode(paths, { forumId, roomId, mode: "auto", now: new Date("2026-07-12T10:07:00.000Z") });
    assert.equal(auto.entry.mode, "auto");
    assert.equal(await getRoomPublishMode(paths, forumId, roomId), "auto");

    // 其他房间不受影响。
    assert.equal(await getRoomPublishMode(paths, forumId, "room_0194f6d2-8c10-7a31-9e42-123456789b20"), "auto");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("publish policy rejects damaged local state", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-publish-policy-damaged-"));
  try {
    const paths = await setup(home);
    await writeFile(paths.publishPolicyFile, '{"formatVersion":1,"entries":[{"forumId":"forum_broken","roomId":"room_broken","mode":"maybe","updatedAt":"x"}]}\n', "utf8");
    await assert.rejects(() => loadPublishPolicy(paths), /invalid|damaged|schema|SCHEMA_VALIDATION_FAILED/u);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("CLI publish policy sets, queries, and gates writes in ask mode", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-publish-policy-cli-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const paths = await setup(home);

    // 默认 auto：post 直接成功。
    const autoPost: string[] = [];
    assert.equal(await runCli(["--json", "post", "create", "--forum", "team", "--room", roomId, "--thread", threadId, "--type", "status", "--body", "Autonomous."], { stdout: (value) => autoPost.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(autoPost.join("")).ok, true);

    // 开启 ask 并查询。
    const setAsk: string[] = [];
    assert.equal(await runCli(["--json", "publish", "policy", "--mode", "ask", "--forum", "team", "--room", "checkout"], { stdout: (value) => setAsk.push(value), stderr: () => undefined }), 0);
    const setResult = JSON.parse(setAsk.join(""));
    assert.equal(setResult.ok, true);
    assert.equal(setResult.data.mode, "ask");
    assert.equal(setResult.data.roomSlug, "checkout");

    const query: string[] = [];
    assert.equal(await runCli(["--json", "publish", "policy", "--forum", "team"], { stdout: (value) => query.push(value), stderr: () => undefined }), 0);
    const queryResult = JSON.parse(query.join(""));
    assert.equal(queryResult.ok, true);
    assert.equal(queryResult.data.entries.length, 1);
    assert.equal(queryResult.data.entries[0].mode, "ask");
    assert.equal(queryResult.data.entries[0].roomSlug, "checkout");

    // ask 模式下 post/thread close 均被硬拦截，且不产生任何写入。
    const blockedPost: string[] = [];
    assert.equal(await runCli(["--json", "post", "create", "--forum", "team", "--room", roomId, "--thread", threadId, "--type", "status", "--body", "Needs approval."], { stdout: (value) => blockedPost.push(value), stderr: () => undefined }), 1);
    const blocked = JSON.parse(blockedPost.join(""));
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, "SEND_AUTHORIZATION_REQUIRED");
    assert.equal(blocked.error.details.roomSlug, "checkout");

    const blockedClose: string[] = [];
    assert.equal(await runCli(["--json", "thread", "close", "--forum", "team", "--room", roomId, "--thread", threadId, "--reason", "No approval."], { stdout: (value) => blockedClose.push(value), stderr: () => undefined }), 1);
    assert.equal(JSON.parse(blockedClose.join("")).error.code, "SEND_AUTHORIZATION_REQUIRED");

    // 切回 auto 后恢复写入。
    const setAuto: string[] = [];
    assert.equal(await runCli(["--json", "publish", "policy", "--mode", "auto", "--forum", "team", "--room", roomId], { stdout: (value) => setAuto.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(setAuto.join("")).data.mode, "auto");
    const recoveredPost: string[] = [];
    assert.equal(await runCli(["--json", "post", "create", "--forum", "team", "--room", roomId, "--thread", threadId, "--type", "status", "--body", "Recovered."], { stdout: (value) => recoveredPost.push(value), stderr: () => undefined }), 0);
    assert.equal(JSON.parse(recoveredPost.join("")).ok, true);
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});
