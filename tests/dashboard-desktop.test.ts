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
  assert.doesNotMatch(source, /executeCli\(\["dashboard", "(?:status|uninstall)", "--json"\]/u, "executeCli already adds the global JSON option");
});

test("Dashboard CLI open 先复用 IPC，再走轻量本机启动检查", async () => {
  const source = await readFile(join(process.cwd(), "src", "commands", "dashboard.ts"), "utf8");
  const start = source.indexOf('if (subcommand === "open")');
  const end = source.indexOf('if (subcommand === "pin")', start);
  assert.ok(start >= 0 && end > start);
  const open = source.slice(start, end);
  const attach = open.indexOf("attachExistingDashboardDesktop(");
  const launchStatus = open.indexOf("getDashboardLaunchStatus(");
  assert.ok(attach >= 0 && launchStatus > attach, "running Desktop attach must precede installation reads");
  assert.doesNotMatch(open, /getDashboardInstallationStatus\(/u, "ordinary open must not recursively hash the installation");
});

test("Dashboard 最后一个 Agent 离开后等待用户手动关闭", async () => {
  const host = await readFile(join(process.cwd(), "dashboard", "host.mjs"), "utf8");
  const page = await readFile(join(process.cwd(), "dashboard", "page.mjs"), "utf8");
  const detach = host.slice(host.indexOf('url.pathname === "/detach"'), host.indexOf('url.pathname === "/room-panel"'));
  const lease = host.slice(host.indexOf("const leaseTimer"), host.lastIndexOf("launchDesktop("));
  assert.doesNotMatch(detach, /shutdown\(/u);
  assert.doesNotMatch(lease, /clients\.size === 0/u);
  assert.match(lease, /runCli\(\["dashboard", "lease-status"\]\)/u, "lease checks must not run the expensive installation status command");
  assert.match(host, /await attachLease\(initialClient, true\)/u);
  assert.match(page, /native\.setSize\(new LogicalSize\(670,barHeight\+panel\)\)/u, "Tauri sizing uses CSS logical pixels and must not apply DPI twice");
  assert.match(page, /window\.__TAURI__\?\.dpi\?\.LogicalSize/u, "remote Tauri window calls must serialize an explicit logical size");
  assert.match(page, /const outerBackground = transparentWindow \? "transparent" : "linear-gradient/u, "transparent native windows need transparent document corners");
  assert.match(page, /html,body\{[^}]*background:\$\{outerBackground\}/u, "document corners must follow the native transparency mode");
  assert.match(host, /platform\(\) !== "darwin"/u, "macOS must retain an opaque document fallback because Tauri transparency uses a private API there");
  assert.doesNotMatch(page, /desktopScale|devicePixelRatio:window\.devicePixelRatio/u, "DPI multiplication would create blank native window space");
  assert.match(page, /\.team-tabs\{[^}]*padding-right:185px/u, "dense Team tabs reserve space for window controls");
  assert.match(page, /\.right\{position:absolute;right:10px;top:9px/u, "window controls stay visible independently of Team tab width");
  assert.match(page, /\.bar\{[^}]*border-radius:10px/u, "Dashboard outer surface keeps a compact radius");
  assert.match(page, /\.teams\{height:34px/u, "Dashboard header leaves balanced vertical space");
  assert.match(page, /\.rooms\{height:72px[^}]*padding:6px 2px 2px/u, "Dashboard Room row balances the header and bottom inset");
  assert.match(page, /\.expanded \.rooms\{height:292px/u, "expanded Dashboard fills its resized native window without an oversized bottom gap");
  assert.match(host, /server\.closeAllConnections\?\.\(\)/u, "Dashboard shutdown must not wait forever for WebView keep-alive sockets");
  const shell = await readFile(join(process.cwd(), "dashboard", "tauri", "src", "main.rs"), "utf8");
  assert.match(shell, /window\.transparent\(true\)\.shadow\(false\)/u, "Windows and Linux must not reserve a black native shadow around the rounded Dashboard surface");
  assert.match(shell, /#\[cfg\(target_os = "macos"\)\][\s\S]*?window\.shadow\(true\)/u, "macOS keeps its supported native rounded shadow path");
});

test("Tauri remote capability only grants Dashboard window controls to its main loopback webview", async () => {
  const capability = JSON.parse(await readFile(join(process.cwd(), "dashboard", "tauri", "capabilities", "dashboard.json"), "utf8")) as { windows?: unknown; remote?: { urls?: unknown }; permissions?: unknown };
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.remote?.urls, ["http://127.0.0.1:*"]);
  assert.deepEqual(capability.permissions, [
    "core:window:allow-close",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-size",
    "core:window:allow-start-dragging",
  ]);
});

test("Dashboard 选择弃用 Room 时保留末尾顺序和可见性", async () => {
  const source = await readFile(join(process.cwd(), "dashboard", "page.mjs"), "utf8");
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
  const source = await readFile(join(process.cwd(), "dashboard", "page.mjs"), "utf8");
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
  const source = await readFile(join(process.cwd(), "dashboard", "page.mjs"), "utf8");
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
  assert.match(source, /t\.status==='closed'\?'<span class="rp-thread-status closed">'\+roomText\('Closed','已关闭'\)\+'<\/span>'/u);
  assert.match(source, /\.rp-thread\.closed/);
  assert.match(source, /message\.bodyHtml/);
  assert.match(source, /receiptBadge\(m\.localReceipt\)/u);
  assert.match(source, /roomText\('Unread','未读'\)/u);
  assert.match(source, /title="Related"/u);
  assert.match(source, /title="Broadcast"/u);
  assert.match(source, /title="Other"/u);
  assert.match(source, /● Active/u);
  assert.doesNotMatch(source, /Active here|Related unread|Broadcast unread|Other unread|AI unread/u);
  assert.match(source, /thread=>thread\.status==='closed'\?\[\]:thread\.messages\.filter/u, "Dashboard unread navigation skips closed Threads");
  assert.match(source, /t\.status!=='closed'&&m\.localReceipt\?\.unreadBy\?\.length/u, "closed Thread messages do not receive Dashboard unread styling");
  assert.match(source, /function refreshOpenRoomPanel\(/u, "an open Room page refreshes when the Dashboard revision changes");
  assert.match(source, /id="room-language"/u, "Dashboard Room page exposes the shared language preference");
  assert.match(source, /api\('\/language'/u);
  assert.match(source, /id="previous-unread"/u);
  assert.match(source, /id="next-unread"/u);
  assert.match(source, /roomUnreadId=null/u);
  assert.match(source, /current<0\?0:\(current\+direction\+entries\.length\)%entries\.length/u, "Dashboard first navigation selects the first unread item as the baseline");
  assert.match(source, /class="rv-actions"/u, "Dashboard Room controls stay in a compact action group");
  assert.match(source, /ai-unread/u, "Dashboard Room messages expose local AI unread targets");
  assert.doesNotMatch(source.slice(source.indexOf("function renderRoomView"), source.indexOf("async function toggleRoomPanel")), /app\.animate/u, "Room page renders must not shake the complete Dashboard");
  assert.doesNotMatch(source, /room-enter/u, "Room view must not scale the entire Dashboard on every render");
  const refreshStart = source.indexOf("function refreshOpenRoomPanel(");
  const refreshEnd = source.indexOf("\nsetInterval(refresh", refreshStart);
  assert.doesNotThrow(() => new Function(source.slice(refreshStart, refreshEnd)), "Room panel refresh script must remain valid JavaScript");
  assert.doesNotMatch(source, /\.rp-header\{position:sticky/u, "duplicate Room information header scrolls with content");
  assert.doesNotMatch(source, /Forum alias ·/);
  assert.doesNotMatch(source, /<strong>Forum<\/strong>/);
});
