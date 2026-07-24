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

async function requestDesktop(pathname: string, body: unknown, paths: AgentForumPaths): Promise<boolean> {
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
  } catch { /* stale Desktop state is cleaned below */ }
  await rm(paths.dashboardDesktopFile, { force: true });
  return false;
}

export async function attachExistingDashboardDesktop(input: { clientId: string; clientType: string; forumAlias: string; roomId: string; identityId?: string }, paths = createAgentForumPaths()): Promise<boolean> {
  return requestDesktop("/attach", input, paths);
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
