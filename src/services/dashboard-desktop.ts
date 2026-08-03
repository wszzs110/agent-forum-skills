import { readFile, rm } from "node:fs/promises";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";

interface DashboardDesktopRuntime {
  formatVersion: 1;
  pid: number;
  port: number;
  token: string;
}

async function readDesktop(paths: AgentForumPaths): Promise<DashboardDesktopRuntime | undefined> {
  try {
    const value = JSON.parse(await readFile(paths.dashboardDesktopFile, "utf8")) as Partial<DashboardDesktopRuntime>;
    return value.formatVersion === 1 && Number.isSafeInteger(value.pid) && value.pid! > 0 && Number.isSafeInteger(value.port) && value.port! > 0 && value.port! <= 65535 && typeof value.token === "string" && /^[a-f0-9-]{36}$/u.test(value.token)
      ? value as DashboardDesktopRuntime
      : undefined;
  } catch { return undefined; }
}

/** 判断 runtime 文件记录的 host 进程是否仍然存在；权限错误按“仍存在”处理以避免误开第二个窗口。 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && typeof error === "object" && "code" in error && error.code === "ESRCH" ? false : true;
  }
}

/**
 * 调用 Dashboard loopback IPC；启动竞态期间可以保留仍由活跃 host 持有的 runtime 文件。
 */
async function requestDesktop(pathname: string, body: unknown, paths: AgentForumPaths, cleanupStale = true): Promise<boolean> {
  const runtime = await readDesktop(paths);
  if (!runtime) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${runtime.port}${pathname}`, {
      method: "POST",
      headers: { authorization: `Bearer ${runtime.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2_000),
    });
    if (response.ok) return true;
  } catch { /* 瞬态启动/响应失败交给调用方决定是否继续等待。 */ }
  if (cleanupStale && !isProcessAlive(runtime.pid)) await rm(paths.dashboardDesktopFile, { force: true });
  return false;
}

export async function attachExistingDashboardDesktop(input: { clientId: string; clientType: string; forumAlias: string; roomId: string; identityId?: string }, paths = createAgentForumPaths()): Promise<boolean> {
  return requestDesktop("/attach", input, paths);
}

/** 等待刚启动的共享 host 写入可用 runtime，并通过 IPC 完成当前客户端附着。 */
export async function waitForExistingDashboardDesktop(
  input: { clientId: string; clientType: string; forumAlias: string; roomId: string; identityId?: string },
  paths = createAgentForumPaths(),
  timeoutMs = 15_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await requestDesktop("/attach", input, paths, false)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}

export async function detachExistingDashboardDesktop(clientId: string, paths = createAgentForumPaths()): Promise<boolean> {
  return requestDesktop("/detach", { clientId }, paths);
}

export async function closeExistingDashboardDesktop(paths = createAgentForumPaths()): Promise<boolean> {
  const requested = await requestDesktop("/close", {}, paths);
  if (!requested) return false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!(await readDesktop(paths))) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}
