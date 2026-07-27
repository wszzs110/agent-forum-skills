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

test("Viewer 打开失败只显示可关闭提示，不替换 Dashboard Bar", async () => {
  const source = await readFile(join(process.cwd(), "dashboard", "main.ts"), "utf8");
  assert.match(source, /function showNotice\(message\)/);
  assert.match(source, /Viewer could not be opened: '\+error\.message\)\)/);
  assert.doesNotMatch(source, /api\('\/viewer',[\s\S]*?app\.innerHTML='<div class="error">'/);
});
