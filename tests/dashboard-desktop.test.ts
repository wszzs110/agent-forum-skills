import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { attachExistingDashboardDesktop, detachExistingDashboardDesktop } from "../src/services/dashboard-desktop.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const token = "12345678-1234-1234-1234-123456789abc";

test("Desktop bridge attaches and detaches through authenticated loopback IPC", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-desktop-"));
  const paths = createAgentForumPaths(home);
  const requests: Array<{ path: string | undefined; authorization: string | undefined; body: unknown }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString("utf8"); });
    request.on("end", () => {
      requests.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) });
      response.writeHead(200, { "content-type": "application/json" }); response.end("{}");
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await mkdir(dirname(paths.dashboardDesktopFile), { recursive: true });
    await writeFile(paths.dashboardDesktopFile, JSON.stringify({ formatVersion: 1, pid: process.pid, port: address.port, token }));
    assert.equal(await attachExistingDashboardDesktop({ clientId: "pi-one", clientType: "pi", forumAlias: "team", roomId: "room_one" }, paths), true);
    assert.equal(await detachExistingDashboardDesktop("pi-one", paths), true);
    assert.deepEqual(requests.map((item) => item.path), ["/attach", "/detach"]);
    assert.equal(requests.every((item) => item.authorization === `Bearer ${token}`), true);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    await rm(home, { recursive: true, force: true });
  }
});

test("Desktop bridge removes stale runtime state", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-dashboard-desktop-stale-"));
  const paths = createAgentForumPaths(home);
  try {
    await mkdir(dirname(paths.dashboardDesktopFile), { recursive: true });
    await writeFile(paths.dashboardDesktopFile, JSON.stringify({ formatVersion: 1, pid: 999999, port: 1, token }));
    assert.equal(await detachExistingDashboardDesktop("pi-one", paths), false);
    await assert.rejects(readFile(paths.dashboardDesktopFile));
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("Pi Dashboard 先复用运行实例，仅在明确不可用时获取安装", async () => {
  const source = await readFile(join(process.cwd(), "adapters", "pi-dashboard.ts"), "utf8");
  const start = source.indexOf("// open（默认）");
  const end = source.indexOf('pi.on("session_shutdown"', start);
  assert.ok(start >= 0 && end > start);
  const openHandler = source.slice(start, end);
  const firstOpen = openHandler.indexOf("let result = await executeCli(openArgs");
  const firstEnsure = openHandler.indexOf('["dashboard", "ensure"]');
  assert.ok(firstOpen >= 0 && firstEnsure > firstOpen, "running Desktop IPC attach must precede acquisition");
  assert.match(openHandler, /result\.error\?\.code === "DASHBOARD_UNAVAILABLE"/u);
  assert.match(openHandler, /finally \{\s*ctx\.ui\.setStatus\("agent-forum-dashboard", undefined\)/u);
});

test("Dashboard 选择弃用 Room 时保留末尾顺序和可见性", async () => {
  const source = await readFile(join(process.cwd(), "dashboard", "main.ts"), "utf8");
  const start = source.indexOf("function orderedRoomIds(");
  const end = source.indexOf("\nfunction roomSignature", start);
  assert.ok(start >= 0 && end > start);
  const orderedRoomIds = new Function(`${source.slice(start, end)};return orderedRoomIds;`)() as (baseOrder: string[], defaultOrder: string[], selectedRoomId: string, rooms: Map<string, { deprecated: boolean }>) => string[];
  const order = ["active-a", "active-b", "deprecated"];
  const rooms = new Map([
    ["active-a", { deprecated: false }],
    ["active-b", { deprecated: false }],
    ["deprecated", { deprecated: true }],
  ]);
  assert.deepEqual(orderedRoomIds(order, order, "deprecated", rooms), order);
  assert.deepEqual(orderedRoomIds(order, order, "active-b", rooms), ["active-b", "active-a", "deprecated"]);
});

test("Dashboard 房间页面明确标记已关闭 Thread", async () => {
  const source = await readFile(join(process.cwd(), "dashboard", "main.ts"), "utf8");
  const start = source.indexOf("function memberColor(");
  const end = source.indexOf("\nfunction bindRoomThreads", start);
  assert.ok(start >= 0 && end > start);
  const renderRoomPanel = new Function("esc", `let expandedThreadId=null;${source.slice(start, end)};return renderRoomPanel;`)((value: unknown) => String(value)) as (data: unknown) => string;
  const html = renderRoomPanel({
    room: { title: "Review", description: "Done" },
    forum: { name: "Team", dataBranch: "main" },
    syncedAt: new Date().toISOString(),
    stats: { threadCount: 1, messageCount: 1, memberCount: 0 },
    threads: [{ id: "thread_closed", kind: "review", status: "closed", title: "Completed review", authorName: "Agent", replyCount: 0, lastActivityAt: new Date().toISOString(), messages: [] }],
    members: [],
  });
  assert.match(html, /class="rp-thread closed"/u);
  assert.match(html, /class="rp-thread-status closed">Closed<\/span>/u);
});

test("Viewer 打开失败只显示可关闭提示，不替换 Dashboard Bar", async () => {
  const source = await readFile(join(process.cwd(), "dashboard", "main.ts"), "utf8");
  assert.match(source, /function showNotice\(message\)/);
  // 房间页面加载失败时使用 showNotice，不替换 Bar
  assert.match(source, /Room page failed: '\+e\.message\)/);
  assert.doesNotMatch(source, /api\('\/viewer',[\s\S]*?app\.innerHTML='<div class="error">'/);
  assert.doesNotMatch(source, /url\.pathname === "\/viewer"/);
  // 小眼睛不再调用 /viewer API 打开浏览器，改为展开房间面板
  assert.match(source, /roomPanelOpen/);
  assert.match(source, /toggleRoomPanel/);
  assert.match(source, /renderRoomView/);
  assert.match(source, /eyeClosed/);
  assert.match(source, /\.room\.deprecated/);
  assert.match(source, /deprecated-badge/);
  assert.match(source, /const promoteSelectedRoom=Boolean/);
  assert.match(source, /!promoteSelectedRoom\|\|roomId!==selectedRoomId/u, "deprecated Room stays in its existing final position when selected");
  assert.match(source, /const roomIds=orderedRoomIds\(baseOrder,defaultOrder,selectedRoomId,byRoomId\)/u);
  assert.doesNotMatch(source, /baseOrder\.filter\(roomId=>roomId!==selectedRoomId&&byRoomId\.has\(roomId\)\)/u);
  assert.match(source, /t\.status==='closed'\?'<span class="rp-thread-status closed">Closed<\/span>'/u);
  assert.match(source, /\.rp-thread\.closed/);
  assert.match(source, /message\.bodyHtml/);
  assert.doesNotMatch(source, /Forum alias ·/);
  assert.doesNotMatch(source, /<strong>Forum<\/strong>/);
});
