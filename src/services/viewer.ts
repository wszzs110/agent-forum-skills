import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { resolveContext } from "./context.js";
import { findForum, loadLocalConfig } from "../config/local-config.js";
import { refreshForumFromRemote } from "./forum-sync.js";
import { refreshForRead, type ReadFreshness } from "./read-freshness.js";
import { getForumSnapshot } from "./timeline-cache.js";
import { ServiceError } from "./errors.js";
import { renderMarkdown, renderViewerHtml, startViewerServer } from "../viewer/server.js";
import { invalidateDashboard } from "./dashboard.js";

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

async function waitForProcessExit(pid: number, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isProcessAlive(pid))) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  return !(await isProcessAlive(pid));
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
    let stopError: unknown;
    try {
      const response = await fetch(`${session.url}close`, {
        method: "POST",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`Viewer close returned HTTP ${response.status}`);
      if (!(await waitForProcessExit(session.pid))) {
        throw new Error("Viewer process did not exit within 5 seconds");
      }
    } catch (error) {
      stopError = error;
    }

    if (!(await isProcessAlive(session.pid))) {
      closed.push(session.sessionId);
      await rm(sessionPath(paths, session.sessionId), { force: true });
      continue;
    }

    if (options.strict) {
      throw new ServiceError(
        "VIEWER_START_FAILED",
        `existing Viewer session could not be closed: ${session.sessionId}`,
        stopError instanceof Error ? { cause: stopError.message } : undefined,
      );
    }
    // 进程仍存活时保留 session 文件，避免制造不可管理的孤儿 Viewer。
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
  openBrowser?: boolean;
}, paths = createAgentForumPaths()): Promise<void> {
  const cached = await getForumSnapshot(input.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === input.room || item.room.slug === input.room);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${input.room}`);
  const server = await startViewerServer({
    snapshot: cached.snapshot,
    roomIdOrSlug: room.room.id,
    token: input.token,
    idleMs: input.idleMs,
    refresh: async () => {
      try {
        const result = await refreshForumFromRemote(input.forumAlias, paths);
        if (result.outcome === "remote-not-configured") {
          return {
            freshness: {
              state: "stale" as const,
              message: "No remote is configured for this Team; latest remote content cannot be verified.",
            },
          };
        }
        if (result.outcome === "skipped-local-commits") {
          return {
            freshness: {
              state: "stale" as const,
              message: "Local commits are not pushed; remote refresh was safely skipped.",
            },
          };
        }
        if (result.outcome === "updated") await invalidateDashboard(paths);
        return { snapshot: (await getForumSnapshot(input.forumAlias, paths)).snapshot, freshness: { state: "fresh" as const } };
      } catch (error) {
        const code = error instanceof ServiceError ? error.code : "SYNC_FAILED";
        return {
          freshness: {
            state: "stale" as const,
            message: `Remote sync failed (${code}).`,
          },
        };
      }
    },
  });
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
  if (input.openBrowser) await openBrowser(server.url);
  await server.closed;
  await rm(sessionPath(paths, input.sessionId), { force: true });
}

export async function launchViewerInline(input: { forumAlias: string; room: string; idleMs?: number }, paths = createAgentForumPaths()): Promise<void> {
  const context = await resolveContext({ forumAlias: input.forumAlias, room: input.room }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  await replaceViewerSessions(context.forumAlias, context.roomId, paths);
  await runViewerServer({
    forumAlias: context.forumAlias,
    room: context.roomId,
    sessionId: randomUUID(),
    token: randomBytes(16).toString("hex"),
    idleMs: input.idleMs ?? 30 * 60_000,
    openBrowser: true,
  }, paths);
}

export function viewerServerLaunchArgs(entryPath: string | undefined, commandArgs: readonly string[], executablePath = process.execPath): string[] {
  if (!entryPath) throw new ServiceError("VIEWER_START_FAILED", "CLI entry path is unavailable");
  // Deno compile 产物的 argv[1] 就是自身可执行文件；再次传入会被 CLI 当作未知子命令。
  return resolve(entryPath) === resolve(executablePath) ? [...commandArgs] : [entryPath, ...commandArgs];
}

export async function openViewer(input: {
  forumAlias?: string;
  room?: string;
  cwd?: string;
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
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, `${context.forumId}-${context.roomId}-viewer.lock`),
    command: "viewer open",
  });
  try {
    const replacedSessionIds = await replaceViewerSessions(context.forumAlias, context.roomId, paths);
    const sessionId = randomUUID();
    const token = randomBytes(16).toString("hex");
    const args = viewerServerLaunchArgs(entryPath, ["viewer", "serve", "--forum", context.forumAlias, "--room", context.roomId, "--session", sessionId, "--token", token, "--idle-ms", String(input.idleMs ?? 30 * 60_000), "--home", dirname(paths.root)]);
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

export interface ViewerRoomData {
  freshness: ReadFreshness;
  room: { id: string; slug: string; title: string; description: string; status: string };
  forum: { alias: string; name: string; dataBranch: string };
  syncedAt: string;
  stats: { threadCount: number; messageCount: number; memberCount: number };
  threads: Array<{
    id: string; title: string; kind: string; status: string;
    authorId: string; authorName: string; replyCount: number; lastActivityAt: string;
    messages: Array<{ id: string; authorId: string; authorName: string; type: string; body: string; bodyHtml: string; replyTo: string | null; createdAt: string }>;
  }>;
  members: Array<{ id: string; displayName: string; role: string; messageCount: number; lastMessageAt: string | null }>;
}

// 为 Dashboard 房间面板提供结构化 JSON 数据，不启动 HTTP server 或子进程。
export async function getViewerRoomData(input: { forumAlias?: string; room?: string; cwd?: string }, paths = createAgentForumPaths()): Promise<ViewerRoomData> {
  const context = await resolveContext({ ...(input.cwd ? { cwd: input.cwd } : {}), ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}), ...(input.room ? { room: input.room } : {}) }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const freshness = await refreshForRead(context.forumAlias, {}, paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId || item.room.slug === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  const snapshot = cached.snapshot;
  // 聚合成员活跃度：统计每个 Room 成员在本房间的消息数和最后发言时间
  const memberStats = new Map<string, { messageCount: number; lastMessageAt: string | null }>();
  const activeMemberIds = Object.entries(room.members).filter(([, m]) => m.status === "active").map(([id]) => id);
  for (const id of activeMemberIds) memberStats.set(id, { messageCount: 0, lastMessageAt: null });
  let totalMessages = 0;
  const threads = room.threads.map((cachedThread) => {
    const messages = cachedThread.timeline.filter((item): item is Extract<typeof item, { kind: "message" }> => item.kind === "message");
    const replyCount = messages.filter((m) => m.replyTo).length;
    let lastActivityAt = cachedThread.thread.createdAt;
    for (const msg of messages) {
      totalMessages += 1;
      if (msg.createdAt > lastActivityAt) lastActivityAt = msg.createdAt;
      const stats = memberStats.get(msg.authorId);
      if (stats) {
        stats.messageCount += 1;
        if (!stats.lastMessageAt || msg.createdAt > stats.lastMessageAt) stats.lastMessageAt = msg.createdAt;
      }
    }
    const creator = snapshot.members[cachedThread.thread.createdBy];
    return {
      id: cachedThread.thread.id, title: cachedThread.thread.title, kind: cachedThread.thread.kind, status: cachedThread.thread.status,
      authorId: cachedThread.thread.createdBy, authorName: creator?.displayName ?? cachedThread.thread.createdBy,
      replyCount, lastActivityAt,
      messages: messages.map((msg) => ({
        id: msg.id, authorId: msg.authorId, authorName: snapshot.members[msg.authorId]?.displayName ?? msg.authorId,
        type: msg.type, body: msg.body, bodyHtml: renderMarkdown(msg.body), replyTo: msg.replyTo ?? null, createdAt: msg.createdAt,
      })),
    };
  });
  threads.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  const members = activeMemberIds.map((id) => {
    const profile = snapshot.members[id];
    const stats = memberStats.get(id)!;
    return { id, displayName: profile?.displayName ?? id, role: profile?.role ?? room.members[id]?.role ?? "", messageCount: stats.messageCount, lastMessageAt: stats.lastMessageAt };
  });
  members.sort((a, b) => b.messageCount - a.messageCount || (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return {
    freshness,
    room: { id: room.room.id, slug: room.room.slug, title: room.room.title, description: room.room.description, status: room.room.status },
    forum: { alias: snapshot.forumAlias, name: snapshot.forum.name, dataBranch: findForum(await loadLocalConfig(paths), snapshot.forumAlias).dataBranch },
    syncedAt: snapshot.generatedAt,
    stats: { threadCount: threads.length, messageCount: totalMessages, memberCount: members.length },
    threads, members,
  };
}

export async function generateViewerHtml(input: { forumAlias?: string; room?: string; cwd?: string; output?: string }, paths = createAgentForumPaths()): Promise<{ output: string }> {
  const context = await resolveContext({ ...(input.cwd ? { cwd: input.cwd } : {}), ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}), ...(input.room ? { room: input.room } : {}) }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const refresh = await refreshForumFromRemote(context.forumAlias, paths);
  if (refresh.outcome === "updated") await invalidateDashboard(paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const output = input.output ?? resolve(paths.viewerDirectory, `${context.roomId}.html`);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  await mkdir(dirname(output), { recursive: true });
  const html = renderViewerHtml(cached.snapshot, room);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(output, html, { encoding: "utf8", mode: 0o600 }));
  return { output };
}
