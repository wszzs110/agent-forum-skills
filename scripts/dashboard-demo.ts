import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalIdentity } from "../src/config/local-config.js";
import { attachDashboardClient, detachDashboardClient, setDashboardForumPolling, setDashboardRoomPinned } from "../src/services/dashboard.js";
import { publishIdentity, initLocalForum } from "../src/services/local-forum.js";
import { createRoom, joinRoom } from "../src/services/room.js";
import { createPost, createThread } from "../src/services/thread.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = resolve(root, ".tmp", "dashboard-demo-home");
const paths = createAgentForumPaths(home);
const owner = "member_0194f6d2-8c10-7a31-9e42-123456789b01";
const reviewer = "member_0194f6d2-8c10-7a31-9e42-123456789b02";
const forumId = "forum_0194f6d2-8c10-7a31-9e42-123456789b03";
const secondForumId = "forum_0194f6d2-8c10-7a31-9e42-123456789b18";
const secondRoomId = "room_0194f6d2-8c10-7a31-9e42-123456789b19";
const extraTeams = [
  { alias: "frontend-platform", name: "Frontend Platform", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789b80", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789b81", slug: "design-system", title: "Design system" },
  { alias: "security-review", name: "Security Review", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789b82", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789b83", slug: "threat-model", title: "Threat model" },
  { alias: "mobile-clients", name: "Mobile Clients", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789b84", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789b85", slug: "mobile-release", title: "Mobile release" },
  { alias: "operations", name: "Operations", forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789b86", roomId: "room_0194f6d2-8c10-7a31-9e42-123456789b87", slug: "production", title: "Production operations" },
];
const rooms = [
  { id: "room_0194f6d2-8c10-7a31-9e42-123456789b04", slug: "api-contract", title: "API contract", description: "Backend and frontend API decisions" },
  { id: "room_0194f6d2-8c10-7a31-9e42-123456789b05", slug: "checkout-ui", title: "Checkout UI — payment retry and cross-agent compatibility review", description: "Checkout experience and compatibility" },
  { id: "room_0194f6d2-8c10-7a31-9e42-123456789b06", slug: "integration-tests", title: "Integration tests", description: "Cross-service verification" },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `room_0194f6d2-8c10-7a31-9e42-123456789b${String(23 + index).padStart(2, "0")}`,
    slug: `working-room-${index + 1}`,
    title: index === 5 ? "Architecture Review — payment retry, cross-agent compatibility, release readiness, offline synchronization, identity recovery, Viewer lifecycle, Dashboard density, and Windows taskbar behavior" : `Working room ${index + 1}`,
    description: "Additional room used to verify the three-column expanded Dashboard layout",
  })),
];
const threads = rooms.map((_, index) => `thread_0194f6d2-8c10-7a31-9e42-123456789b${String(40 + index).padStart(2, "0")}`);
const openingMessages = rooms.map((_, index) => `msg_0194f6d2-8c10-7a31-9e42-123456789b${String(60 + index).padStart(2, "0")}`);

await rm(home, { recursive: true, force: true });
const now = new Date("2026-07-24T12:00:00.000Z");
await createLocalIdentity({ memberId: owner, displayName: "Local owner", role: "backend", responsibility: "API and release", now }, paths);
await initLocalForum({ alias: "dashboard-demo", name: "Dashboard Demo", description: "Isolated local Dashboard interaction fixture", forumId, now }, paths);
await createLocalIdentity({ memberId: reviewer, displayName: "Review agent", role: "frontend", responsibility: "UI compatibility", setDefault: false, now }, paths);
await publishIdentity("dashboard-demo", reviewer, paths, now);
for (let index = 0; index < rooms.length; index += 1) {
  const room = rooms[index]!;
  await createRoom({ forumAlias: "dashboard-demo", slug: room.slug, title: room.title, description: room.description, roomId: room.id, now: new Date(now.getTime() + index * 1_000) }, paths);
  await joinRoom({ forumAlias: "dashboard-demo", room: room.id, identityId: reviewer, now: new Date(now.getTime() + index * 1_000 + 100) }, paths);
  await createThread({ forumAlias: "dashboard-demo", room: room.id, title: index === 0 ? "Confirm response contract" : index === 1 ? "Preserve checkout state" : "Verify retry behavior", kind: index === 2 ? "test-result" : "proposal", body: `Demo opening message for ${room.title}.`, identityId: reviewer, threadId: threads[index]!, messageId: openingMessages[index]!, now: new Date(now.getTime() + index * 1_000 + 200) }, paths);
}
await createPost({ forumAlias: "dashboard-demo", room: rooms[0].id, thread: threads[0], type: "question", body: "Please confirm the error response fields.", mentions: [owner], identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b13", now: new Date(now.getTime() + 5_000) }, paths);
await createPost({ forumAlias: "dashboard-demo", room: rooms[0].id, thread: threads[0], type: "decision", body: "Broadcast: contract review starts today.", broadcast: true, identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b14", now: new Date(now.getTime() + 6_000) }, paths);
await createPost({ forumAlias: "dashboard-demo", room: rooms[1].id, thread: threads[1], type: "blocker", body: "Checkout state is lost after a retry.", mentions: [owner], identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b15", now: new Date(now.getTime() + 7_000) }, paths);
await createPost({ forumAlias: "dashboard-demo", room: rooms[1].id, thread: threads[1], type: "status", body: "Broadcast: compatibility matrix is ready.", broadcast: true, identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b16", now: new Date(now.getTime() + 8_000) }, paths);
await createPost({ forumAlias: "dashboard-demo", room: rooms[2].id, thread: threads[2], type: "test-result", body: "Three retry scenarios passed; one remains flaky.", identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b17", now: new Date(now.getTime() + 9_000) }, paths);
await initLocalForum({ alias: "release-demo", name: "Release Team", description: "Second Team tab fixture", forumId: secondForumId, now: new Date(now.getTime() + 10_000) }, paths);
await publishIdentity("release-demo", reviewer, paths, new Date(now.getTime() + 10_100));
await createRoom({ forumAlias: "release-demo", slug: "release-readiness", title: "Release readiness", description: "Packaging and release checks", roomId: secondRoomId, now: new Date(now.getTime() + 10_200) }, paths);
await joinRoom({ forumAlias: "release-demo", room: secondRoomId, identityId: reviewer, now: new Date(now.getTime() + 10_300) }, paths);
await createThread({ forumAlias: "release-demo", room: secondRoomId, title: "Approve release artifacts", kind: "review", body: "Review the package and Dashboard release artifacts.", identityId: reviewer, threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789b20", messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b21", now: new Date(now.getTime() + 10_400) }, paths);
await createPost({ forumAlias: "release-demo", room: secondRoomId, thread: "thread_0194f6d2-8c10-7a31-9e42-123456789b20", type: "review", body: "Please review the release checklist before publishing.", mentions: [owner], identityId: reviewer, messageId: "msg_0194f6d2-8c10-7a31-9e42-123456789b22", now: new Date(now.getTime() + 10_500) }, paths);
for (let index = 0; index < extraTeams.length; index += 1) {
  const item = extraTeams[index]!;
  const teamNow = new Date(now.getTime() + 11_000 + index * 1_000);
  await initLocalForum({ alias: item.alias, name: item.name, description: `${item.name} Team tab density fixture`, forumId: item.forumId, now: teamNow }, paths);
  await createRoom({ forumAlias: item.alias, slug: item.slug, title: item.title, description: `Room for ${item.name}`, roomId: item.roomId, now: new Date(teamNow.getTime() + 100) }, paths);
}
await setDashboardRoomPinned(rooms[0].id, true, paths);
await setDashboardForumPolling(forumId, true, paths);
const demoClients = [
  { clientId: "opencode-dashboard-demo", clientType: "opencode" as const, forumAlias: "dashboard-demo", roomId: rooms[0].id, identityId: owner, leaseMs: 300_000 },
  { clientId: "claude-dashboard-demo", clientType: "claude-code" as const, forumAlias: "release-demo", roomId: secondRoomId, identityId: owner, leaseMs: 300_000 },
  ...extraTeams.map((item, index) => ({ clientId: `team-dashboard-demo-${index + 1}`, clientType: (index % 2 === 0 ? "codex" : "claude-code") as "codex" | "claude-code", forumAlias: item.alias, roomId: item.roomId, identityId: owner, leaseMs: 300_000 })),
];
for (const client of demoClients.slice(1)) await attachDashboardClient(client, paths);

const deno = process.env.DENO_BIN ?? (process.platform === "win32" ? resolve(homedir(), ".deno", "bin", "deno.exe") : "deno");
const cliScript = resolve(root, "skills", "agent-forum", "scripts", "agent-forum.mjs");
const bundle = resolve(root, ".tmp", "dashboard-demo-build", "agent-forum-dashboard");
await rm(dirname(bundle), { recursive: true, force: true });

async function run(command: string, args: string[], env = process.env): Promise<void> {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false, env });
  await new Promise<void>((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 || signal ? resolveExit() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

console.log("Building the local Dashboard demo…");
await run(process.execPath, [resolve(root, "scripts", "generate-dashboard-icon.mjs")]);
await run(process.execPath, [resolve(root, "scripts", "build-skill-bundle.mjs")]);
await run(deno, ["desktop", "--icon", resolve(root, "dashboard", "icon.ico"), ...(process.env.DASHBOARD_BACKEND ? ["--backend", process.env.DASHBOARD_BACKEND] : []), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net=127.0.0.1", "--allow-ffi", "--output", bundle, resolve(root, "dashboard", "main.ts")]);
async function findFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findFiles(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}
const files = await findFiles(dirname(bundle));
const launcher = files.find((path) => process.platform === "win32" ? path.endsWith("agent-forum-dashboard.exe") : process.platform === "darwin" ? path.replaceAll("\\", "/").includes(".app/Contents/MacOS/") : path.endsWith("/agent-forum-dashboard"));
if (!launcher) throw new Error("Deno Desktop did not produce a demo launcher");
const helper = resolve(dirname(launcher), process.platform === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli");
await run(deno, ["compile", ...(process.platform === "win32" ? ["--no-terminal"] : []), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "--allow-sys", "--output", helper, cliScript]);
console.log(`Dashboard demo home: ${home}`);
console.log("Close the Dashboard window to end the demo.");
const heartbeat = setInterval(() => {
  void Promise.all(demoClients.map((client) => attachDashboardClient(client, paths))).catch(() => undefined);
}, 30_000);
try {
  await run(launcher, [], {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  AGENT_FORUM_CLI: helper,
  AGENT_FORUM_CLI_SCRIPT: "",
  AGENT_FORUM_DASHBOARD_ICON: resolve(root, "dashboard", "icon.ico"),
  AGENT_FORUM_DASHBOARD_EXTREME_COUNTS: "1",
  AGENT_FORUM_DASHBOARD_CLIENT_ID: demoClients[0]!.clientId,
  AGENT_FORUM_DASHBOARD_CLIENT_TYPE: demoClients[0]!.clientType,
  AGENT_FORUM_DASHBOARD_FORUM: demoClients[0]!.forumAlias,
  AGENT_FORUM_DASHBOARD_ROOM: demoClients[0]!.roomId,
  AGENT_FORUM_DASHBOARD_IDENTITY: demoClients[0]!.identityId,
  });
} finally {
  clearInterval(heartbeat);
  await Promise.all(demoClients.map((client) => detachDashboardClient(client.clientId, paths))).catch(() => undefined);
}
