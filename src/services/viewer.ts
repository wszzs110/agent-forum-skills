import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { resolveContext } from "./context.js";
import { refreshForumFromRemote } from "./forum-sync.js";
import { getForumSnapshot } from "./timeline-cache.js";
import { ServiceError } from "./errors.js";
import { renderViewerHtml, startViewerServer } from "../viewer/server.js";

export interface ViewerSession {
  formatVersion: 1;
  sessionId: string;
  forumAlias: string;
  roomId: string;
  url: string;
  pid: number;
  startedAt: string;
}

function sessionPath(paths: AgentForumPaths, id: string): string {
  if (!/^[0-9a-f-]{36}$/u.test(id)) throw new ServiceError("VIEWER_SESSION_NOT_FOUND", "invalid Viewer session ID");
  return resolve(paths.viewerDirectory, `${id}.json`);
}

async function isProcessAlive(pid: number): Promise<boolean> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readSession(path: string): Promise<ViewerSession | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as ViewerSession;
    const url = new URL(value.url);
    const validUrl = url.protocol === "http:" && url.hostname === "127.0.0.1" && /^\/session\/[0-9a-f]{32}\/$/u.test(url.pathname);
    return value.formatVersion === 1 &&
      /^[0-9a-f-]{36}$/u.test(value.sessionId) &&
      Number.isSafeInteger(value.pid) && value.pid > 0 && validUrl
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export async function listViewerSessions(paths = createAgentForumPaths()): Promise<ViewerSession[]> {
  let names: string[] = [];
  try { names = await readdir(paths.viewerDirectory); } catch { return []; }
  const sessions: ViewerSession[] = [];
  for (const name of names.filter((name) => name.endsWith(".json"))) {
    const path = resolve(paths.viewerDirectory, name);
    const session = await readSession(path);
    if (session && await isProcessAlive(session.pid)) sessions.push(session);
    else await rm(path, { force: true });
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function cleanViewerSessions(paths = createAgentForumPaths()): Promise<{ removed: number }> {
  let names: string[] = [];
  try { names = await readdir(paths.viewerDirectory); } catch { return { removed: 0 }; }
  let removed = 0;
  for (const name of names.filter((name) => name.endsWith(".json") || name.endsWith(".ready"))) {
    const path = resolve(paths.viewerDirectory, name);
    const session = name.endsWith(".json") ? await readSession(path) : undefined;
    if (!session || !(await isProcessAlive(session.pid))) {
      await rm(path, { force: true });
      removed += 1;
    }
  }
  return { removed };
}

async function stopViewerSessions(
  sessions: ViewerSession[],
  paths: AgentForumPaths,
  options: { strict?: boolean } = {},
): Promise<string[]> {
  const closed: string[] = [];
  for (const session of sessions) {
    try {
      const response = await fetch(`${session.url}close`, {
        method: "POST",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`Viewer close returned HTTP ${response.status}`);
      closed.push(session.sessionId);
    } catch (error) {
      if (options.strict) {
        throw new ServiceError(
          "VIEWER_START_FAILED",
          `existing Viewer session could not be closed: ${session.sessionId}`,
          error instanceof Error ? { cause: error.message } : undefined,
        );
      }
      // 失效 session 随后作为 stale state 清理。
    }
    await rm(sessionPath(paths, session.sessionId), { force: true });
  }
  return closed;
}

export async function closeViewerSession(sessionId: string | undefined, paths = createAgentForumPaths()): Promise<{ closed: string[] }> {
  const sessions = await listViewerSessions(paths);
  const selected = sessionId ? sessions.filter((session) => session.sessionId === sessionId) : sessions;
  if (sessionId && selected.length === 0) throw new ServiceError("VIEWER_SESSION_NOT_FOUND", `Viewer session not found: ${sessionId}`);
  return { closed: await stopViewerSessions(selected, paths) };
}

async function replaceViewerSessions(
  forumAlias: string,
  roomId: string,
  paths: AgentForumPaths,
): Promise<string[]> {
  const existing = (await listViewerSessions(paths)).filter(
    (session) => session.forumAlias === forumAlias && session.roomId === roomId,
  );
  return stopViewerSessions(existing, paths, { strict: true });
}

async function openBrowser(url: string): Promise<boolean> {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "start", "", url] : [url];
  return new Promise((resolveOpen) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    child.once("error", () => resolveOpen(false));
    child.once("spawn", () => {
      child.unref();
      resolveOpen(true);
    });
  });
}

export async function runViewerServer(input: {
  forumAlias: string;
  room: string;
  sessionId: string;
  token: string;
  idleMs: number;
  sync: boolean;
}, paths = createAgentForumPaths()): Promise<void> {
  const cached = await getForumSnapshot(input.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === input.room || item.room.slug === input.room);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${input.room}`);
  const server = await startViewerServer({ snapshot: cached.snapshot, roomIdOrSlug: room.room.id, token: input.token, idleMs: input.idleMs });
  const session: ViewerSession = {
    formatVersion: 1,
    sessionId: input.sessionId,
    forumAlias: input.forumAlias,
    roomId: room.room.id,
    url: server.url,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  await mkdir(paths.viewerDirectory, { recursive: true });
  await writeJsonAtomic(sessionPath(paths, input.sessionId), session, { overwrite: true, mode: 0o600 });
  if (input.sync) {
    void refreshForumFromRemote(input.forumAlias, paths)
      .then(() => getForumSnapshot(input.forumAlias, paths))
      .then((fresh) => server.updateSnapshot(fresh.snapshot))
      .catch(() => undefined);
  }
  await server.closed;
  await rm(sessionPath(paths, input.sessionId), { force: true });
}

export async function openViewer(input: {
  forumAlias?: string;
  room?: string;
  cwd?: string;
  sync?: boolean;
  openBrowser?: boolean;
  idleMs?: number;
  entryPath?: string;
}, paths = createAgentForumPaths()): Promise<ViewerSession & { browserOpened: boolean; replacedSessionIds: string[] }> {
  const context = await resolveContext({
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}),
    ...(input.room ? { room: input.room } : {}),
  }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const entryPath = input.entryPath ?? process.argv[1];
  if (!entryPath) throw new ServiceError("VIEWER_START_FAILED", "CLI entry path is unavailable");
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, `${context.forumId}-${context.roomId}-viewer.lock`),
    command: "viewer open",
  });
  try {
    const replacedSessionIds = await replaceViewerSessions(context.forumAlias, context.roomId, paths);
    const sessionId = randomUUID();
    const token = randomBytes(16).toString("hex");
    const args = [entryPath, "viewer", "serve", "--forum", context.forumAlias, "--room", context.roomId, "--session", sessionId, "--token", token, "--idle-ms", String(input.idleMs ?? 30 * 60_000), "--home", dirname(paths.root)];
    if (input.sync === false) args.push("--no-sync");
    const child = spawn(process.execPath, args, { detached: true, stdio: "ignore", shell: false, windowsHide: true });
    let startError: Error | undefined;
    child.once("error", (error) => { startError = error; });
    child.unref();
    const path = sessionPath(paths, sessionId);
    const deadline = Date.now() + 10_000;
    let session: ViewerSession | undefined;
    while (Date.now() < deadline) {
      session = await readSession(path);
      if (session) break;
      if (!(await isProcessAlive(child.pid ?? -1))) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    if (!session) throw new ServiceError("VIEWER_START_FAILED", startError?.message ?? "Viewer did not become ready within 10 seconds");
    const browserOpened = input.openBrowser === false ? false : await openBrowser(session.url);
    return { ...session, browserOpened, replacedSessionIds };
  } finally {
    await lock.release();
  }
}

export async function generateViewerHtml(input: { forumAlias?: string; room?: string; cwd?: string; output?: string }, paths = createAgentForumPaths()): Promise<{ output: string }> {
  const context = await resolveContext({ ...(input.cwd ? { cwd: input.cwd } : {}), ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}), ...(input.room ? { room: input.room } : {}) }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const output = input.output ?? resolve(paths.viewerDirectory, `${context.roomId}.html`);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  await mkdir(dirname(output), { recursive: true });
  const html = renderViewerHtml(cached.snapshot, room);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(output, html, { encoding: "utf8", mode: 0o600 }));
  return { output };
}
