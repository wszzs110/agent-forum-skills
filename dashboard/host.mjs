import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { watch } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { page } from "./page.mjs";

const cli = process.env.AGENT_FORUM_CLI ?? "agent-forum";
const cliScript = process.env.AGENT_FORUM_CLI_SCRIPT || undefined;
const desktopExecutable = process.env.AGENT_FORUM_DASHBOARD_EXECUTABLE;
const home = process.env[platform() === "win32" ? "USERPROFILE" : "HOME"] ?? homedir();
const stateDirectory = join(home, ".AgentForum", "state", "dashboard");
const desktopFile = join(stateDirectory, "desktop.json");
const lockFile = join(stateDirectory, "desktop.lock");
const token = randomUUID();

if (!desktopExecutable) throw new Error("缺少 AGENT_FORUM_DASHBOARD_EXECUTABLE");

/** 验证从 Agent 客户端传入的 Dashboard 租约身份。 */
function validClient(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  return typeof item.clientId === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(item.clientId) &&
    typeof item.clientType === "string" && ["pi", "opencode", "codex", "claude-code"].includes(item.clientType) &&
    typeof item.forumAlias === "string" && item.forumAlias.length > 0 &&
    typeof item.roomId === "string" && item.roomId.length > 0 &&
    (item.identityId === undefined || typeof item.identityId === "string");
}

const initialClient = {
  clientId: process.env.AGENT_FORUM_DASHBOARD_CLIENT_ID ?? "",
  clientType: process.env.AGENT_FORUM_DASHBOARD_CLIENT_TYPE ?? "",
  forumAlias: process.env.AGENT_FORUM_DASHBOARD_FORUM ?? "",
  roomId: process.env.AGENT_FORUM_DASHBOARD_ROOM ?? "",
  ...(process.env.AGENT_FORUM_DASHBOARD_IDENTITY ? { identityId: process.env.AGENT_FORUM_DASHBOARD_IDENTITY } : {}),
};
if (!validClient(initialClient)) throw new Error("Dashboard 启动上下文无效");

const clients = new Map();
const pendingPollingPreferences = new Map();
const pollingActiveForumIds = new Set();
let shuttingDown = false;
let desktopProcess;
let lock;
let stateWatcher;
let cachedSnapshot;
let snapshotRefresh;
let pollingPreferenceGeneration = 0;
let pollingSequence = 0;
let lastPollingForumId;
let lastPollingStartedAt;
let uiLanguage = "en";
const demoExtremeCounts = process.env.AGENT_FORUM_DASHBOARD_EXTREME_COUNTS === "1";
// 标准 Wayland 不提供普通应用可稳定请求的全局置顶层，页面必须明确禁用而不是伪装成功。
const alwaysOnTopSupported = !(platform() === "linux" && Boolean(process.env.WAYLAND_DISPLAY));

/** 构造隔离 Dashboard 自身 loopback 端口后的 CLI 环境。 */
function dashboardCliEnvironment() {
  const environment = { ...process.env, HOME: home, ...(platform() === "win32" ? { USERPROFILE: home } : {}) };
  delete environment.PORT;
  return environment;
}

/** 读取受限长度的 HTTP JSON 请求体。 */
async function readRequestJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw new Error("Dashboard 请求过大");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("Dashboard 请求不是有效 JSON"); }
}

/** 以 Node 运行当前 npm 包提供的 CLI，并只接受其 JSON 协议输出。 */
function runCli(args) {
  return new Promise((resolveCli, rejectCli) => {
    const child = spawn(cli, [...(cliScript ? [cliScript] : []), "--json", ...args], {
      cwd: stateDirectory,
      env: dashboardCliEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = [];
    const errors = [];
    let outputLength = 0;
    child.stdout.on("data", (chunk) => {
      outputLength += chunk.length;
      if (outputLength <= 2 * 1024 * 1024) output.push(chunk);
      else child.kill();
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.concat(errors).length < 128 * 1024) errors.push(chunk);
    });
    child.on("error", (error) => rejectCli(new Error(`无法启动 agent-forum：${error.message}`)));
    child.on("close", (code) => {
      const stdout = Buffer.concat(output).toString("utf8").trim();
      const stderr = Buffer.concat(errors).toString("utf8").trim();
      if (code !== 0 || !stdout) {
        rejectCli(new Error(stderr || `agent-forum 命令失败（退出码 ${code ?? "unknown"}）`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed?.ok === false) throw new Error(`${parsed.error?.code ?? "CLI_ERROR"}: ${parsed.error?.message ?? "未知错误"}`);
        resolveCli(parsed?.data);
      } catch (error) {
        rejectCli(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

/** 启动非关键后台 CLI 工作并将失败限制在当前轮询内。 */
function startCli(args) {
  return runCli(args).then(() => true, () => false);
}

/** 将一个 Dashboard 客户端写入统一的 CLI 租约状态。 */
async function attachLease(input, resetView = false) {
  if (!validClient(input)) throw new Error("Dashboard 客户端无效");
  const args = ["dashboard", "attach", "--client-id", input.clientId, "--client-type", input.clientType, "--forum", input.forumAlias, "--room", input.roomId];
  if (input.clientType !== "pi") args.push("--lease-ms", "300000");
  if (resetView) args.push("--reset-view");
  if (input.identityId) args.push("--identity", input.identityId);
  await runCli(args);
  clients.set(input.clientId, input);
}

/** 解除客户端租约；关闭阶段的单个失败不得阻断其他客户端清理。 */
async function detachLease(clientId) {
  clients.delete(clientId);
  await runCli(["dashboard", "detach", "--client-id", clientId]).catch(() => undefined);
}

/** 将待持久化的 polling 偏好覆盖到内存快照，避免子进程短暂竞态造成 UI 回跳。 */
function applyPendingPollingPreferences(value) {
  if (pendingPollingPreferences.size === 0 || !value || typeof value !== "object") return value;
  return {
    ...value,
    teams: (value.teams ?? []).map((team) => {
      const pending = typeof team.forumId === "string" ? pendingPollingPreferences.get(team.forumId) : undefined;
      return pending ? { ...team, polling: pending.enabled } : team;
    }),
  };
}

/** 合并同一时刻的 snapshot 请求，防止 UI 轮询并发重复执行昂贵 CLI 查询。 */
function refreshSnapshot() {
  snapshotRefresh ??= runCli(["dashboard", "snapshot"])
    .then((value) => { cachedSnapshot = applyPendingPollingPreferences(value); })
    .finally(() => { snapshotRefresh = undefined; });
  return snapshotRefresh;
}

/** 检查运行中的 host 是否已可附加，从而避免 stale lock 被误删。 */
async function attachToExisting(input) {
  // attach 租约与后续 snapshot 均通过 CLI 完成，可能耗时数秒；给首个实例足够长的启动与响应窗口。
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const runtime = JSON.parse(await readFile(desktopFile, "utf8"));
      const response = await fetch(`http://127.0.0.1:${runtime.port}/attach`, {
        method: "POST",
        headers: { authorization: `Bearer ${runtime.token}`, "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return true;
    } catch {
      // 首个 host 写入 desktop.json 前或已异常退出时均可安全重试。
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  return false;
}

/** 创建唯一 host 锁；无法附加的旧锁按已失效运行时清理。 */
async function acquireDesktopLock() {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  try { return await open(lockFile, "wx", 0o600); }
  catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      if (await attachToExisting(initialClient)) process.exit(0);
      await rm(lockFile, { force: true });
      await rm(desktopFile, { force: true });
      return open(lockFile, "wx", 0o600);
    }
    throw error;
  }
}

/** 验证 loopback UI 请求携带了随机 token。 */
function authorized(request, url) {
  return request.headers.authorization === `Bearer ${token}` || url.searchParams.get("token") === token;
}

/** 发送 no-store JSON 响应，避免系统 WebView 缓存旧 snapshot。 */
function sendJson(response, status, value) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value)}\n`);
}

/** 发送简短文本错误，禁止把宿主细节与 token 泄露到页面。 */
function sendError(response, status, message) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" });
  response.end(message);
}

/** 在 host 退出后关闭循环定时器、释放租约与清理本机运行时文件。 */
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(pollingTimer);
  clearInterval(leaseTimer);
  stateWatcher?.close();
  if (desktopProcess && !desktopProcess.killed) desktopProcess.kill();
  for (const clientId of [...clients.keys()]) await detachLease(clientId);
  // 页面每 1 秒轮询 snapshot，且 WebView 与系统代理会保持 keep-alive 连接；
  // 必须先销毁存量 socket，否则 server.close() 永久等待并留下僵尸 host。
  server.closeAllConnections?.();
  await new Promise((resolveClose) => server.close(() => resolveClose()));
  await rm(desktopFile, { force: true });
  await lock?.close().catch(() => undefined);
  await rm(lockFile, { force: true });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (url.pathname === "/" && request.method === "GET") {
    if (!authorized(request, url)) { sendError(response, 401, "Unauthorized"); return; }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; connect-src 'self'; img-src data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      "content-type": "text/html; charset=utf-8",
    });
    response.end(page(url.origin, token, demoExtremeCounts, alwaysOnTopSupported, uiLanguage, platform() !== "darwin"));
    return;
  }
  if (!authorized(request, url)) { sendError(response, 401, "Unauthorized"); return; }
  try {
    if (url.pathname === "/snapshot" && request.method === "GET") { sendJson(response, 200, cachedSnapshot); return; }
    if (url.pathname === "/polling-status" && request.method === "GET") {
      sendJson(response, 200, { sequence: pollingSequence, activeForumIds: [...pollingActiveForumIds], ...(lastPollingForumId ? { lastForumId: lastPollingForumId } : {}), ...(lastPollingStartedAt ? { lastStartedAt: lastPollingStartedAt } : {}) });
      return;
    }
    if (url.pathname === "/ready" && request.method === "POST") { sendJson(response, 200, { ready: true }); return; }
    if (url.pathname === "/window" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (![0, 1, 3].includes(value?.mode)) { sendError(response, 400, "invalid window mode"); return; }
      const panelHeight = typeof value.panelHeight === "number" && value.panelHeight > 0 ? Math.min(value.panelHeight, 520) : 0;
      sendJson(response, 200, { mode: value.mode, panelHeight });
      return;
    }
    if (url.pathname === "/top" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (typeof value?.enabled !== "boolean") { sendError(response, 400, "invalid always-on-top request"); return; }
      if (!alwaysOnTopSupported) { sendError(response, 409, "Always-on-top is unavailable under this Wayland session in this release; it requires an explicit GNOME Shell integration."); return; }
      sendJson(response, 200, { enabled: value.enabled });
      return;
    }
    if (url.pathname === "/close" && request.method === "POST") { sendJson(response, 200, { closing: true }); setTimeout(() => void shutdown(), 0); return; }
    if (url.pathname === "/language" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (value?.language !== "en" && value?.language !== "zh") { sendError(response, 400, "invalid language"); return; }
      await runCli(["preference", "language", "--value", value.language]);
      uiLanguage = value.language;
      sendJson(response, 200, { language: uiLanguage });
      return;
    }
    if (url.pathname === "/attach" && request.method === "POST") {
      await attachLease(await readRequestJson(request));
      await refreshSnapshot();
      sendJson(response, 200, { attached: true });
      return;
    }
    if (url.pathname === "/detach" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (typeof value?.clientId !== "string") { sendError(response, 400, "invalid client"); return; }
      await detachLease(value.clientId);
      sendJson(response, 200, { detached: true });
      return;
    }
    if (url.pathname === "/room-panel" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (typeof value?.forumAlias !== "string" || typeof value?.roomId !== "string" || (value.identityIds !== undefined && (!Array.isArray(value.identityIds) || !value.identityIds.every((id) => typeof id === "string")))) { sendError(response, 400, "invalid room panel request"); return; }
      const result = await runCli(["viewer", "data", "--forum", value.forumAlias, "--room", value.roomId, ...(value.identityIds ?? []).flatMap((id) => ["--identity", id])]);
      sendJson(response, 200, result);
      return;
    }
    if (url.pathname === "/poll" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (typeof value?.forumId !== "string" || typeof value?.enabled !== "boolean") { sendError(response, 400, "invalid polling request"); return; }
      const preference = { enabled: value.enabled, generation: ++pollingPreferenceGeneration };
      pendingPollingPreferences.set(value.forumId, preference);
      cachedSnapshot = applyPendingPollingPreferences({ ...cachedSnapshot, revision: (cachedSnapshot?.revision ?? 0) + 1 });
      void startCli(["dashboard", "polling", "--forum-id", value.forumId, "--enabled", String(value.enabled)]).then(async (success) => {
        if (pendingPollingPreferences.get(value.forumId)?.generation !== preference.generation) return;
        if (!success) { pendingPollingPreferences.delete(value.forumId); await refreshSnapshot().catch(() => undefined); return; }
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const persisted = await runCli(["dashboard", "snapshot"]).catch(() => undefined);
          if (pendingPollingPreferences.get(value.forumId)?.generation !== preference.generation) return;
          const persistedTeam = persisted?.teams?.find((team) => team.forumId === value.forumId);
          if (persistedTeam?.polling === preference.enabled) { pendingPollingPreferences.delete(value.forumId); cachedSnapshot = persisted; return; }
          if (persisted) cachedSnapshot = applyPendingPollingPreferences(persisted);
          await new Promise((resolveWait) => setTimeout(resolveWait, 100));
        }
        pendingPollingPreferences.delete(value.forumId);
        await refreshSnapshot().catch(() => undefined);
      });
      sendJson(response, 200, { forumId: value.forumId, enabled: value.enabled, pending: true });
      return;
    }
    if (url.pathname === "/pin" && request.method === "POST") {
      const value = await readRequestJson(request);
      if (typeof value?.roomId !== "string" || typeof value?.enabled !== "boolean") { sendError(response, 400, "invalid pin request"); return; }
      const result = await runCli(["dashboard", "pin", "--room-id", value.roomId, "--enabled", String(value.enabled)]);
      await refreshSnapshot();
      sendJson(response, 200, result);
      return;
    }
    sendError(response, 404, "Not found");
  } catch (error) {
    sendError(response, 500, error instanceof Error ? error.message : "Dashboard error");
  }
});

/** 监听随机 loopback 端口并返回其实际地址。 */
function listenServer() {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen(server.address());
    });
  });
}

/** 原子写入供其他 Agent 客户端附加的 desktop runtime 信息。 */
async function writeDesktopRuntime(port) {
  const temporary = `${desktopFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ formatVersion: 1, pid: process.pid, port, token }, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, desktopFile);
}

/** 启动受系统 WebView 承载的 Tauri 窗口，并在异常退出时收拢 host。 */
function launchDesktop(url) {
  const child = spawn(desktopExecutable, [], {
    cwd: stateDirectory,
    detached: false,
    shell: false,
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, AGENT_FORUM_DASHBOARD_URL: url },
  });
  desktopProcess = child;
  child.on("error", () => void shutdown());
  child.on("close", () => {
    if (desktopProcess === child) void shutdown();
  });
}

lock = await acquireDesktopLock();
await attachLease(initialClient, true);
try {
  const preference = await runCli(["preference", "language"]);
  if (preference?.language === "zh") uiLanguage = "zh";
} catch {
  // 偏好查询不可阻断 Dashboard 主窗口启动。
}
cachedSnapshot = await runCli(["dashboard", "snapshot"]);
const address = await listenServer();
if (!address || typeof address === "string") throw new Error("Dashboard 未获得 loopback 端口");
await writeDesktopRuntime(address.port);
/** 监听原子替换产生的状态文件事件，确保绑定变化立即刷新本机 Dashboard snapshot。 */
function refreshOnStateChange(_event, fileName) {
  const normalized = String(fileName ?? "").replaceAll("\\", "/");
  if (!shuttingDown && (normalized.endsWith("runtime.json") || normalized.endsWith("context-bindings.json"))) void refreshSnapshot().catch(() => undefined);
}
stateWatcher = watch(stateDirectory, { persistent: false });
stateWatcher.on("change", refreshOnStateChange);
stateWatcher.on("rename", refreshOnStateChange);
const pollingTimer = setInterval(async () => {
  if (shuttingDown || pollingActiveForumIds.size > 0) return;
  const snapshot = cachedSnapshot;
  for (const team of snapshot?.teams ?? []) if (team.polling) {
    pollingActiveForumIds.add(team.forumId);
    pollingSequence += 1;
    lastPollingForumId = team.forumId;
    lastPollingStartedAt = new Date().toISOString();
    try { await runCli(["forum", "sync", "--forum", team.forumAlias]).catch(() => undefined); }
    finally { pollingActiveForumIds.delete(team.forumId); }
  }
  await refreshSnapshot().catch(() => undefined);
}, 60_000);
const leaseTimer = setInterval(async () => {
  if (shuttingDown) return;
  try {
    const status = await runCli(["dashboard", "lease-status"]);
    const active = new Set((status?.clients ?? []).map((client) => client.clientId));
    for (const clientId of clients.keys()) if (!active.has(clientId)) clients.delete(clientId);
  } catch {
    // 瞬态 CLI 故障不得误删仍可能有效的展示窗口。
  }
}, 10_000);
launchDesktop(`http://127.0.0.1:${address.port}/?token=${encodeURIComponent(token)}`);
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
