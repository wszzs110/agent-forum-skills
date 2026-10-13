import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { resolveContext, type ResolvedContextView } from "./context.js";
import { ContextError } from "../context/bindings.js";
import { findForum, loadLocalConfig } from "../config/local-config.js";
import { refreshForumFromRemote } from "./forum-sync.js";
import { refreshForRead, type ReadFreshness } from "./read-freshness.js";
import { getForumSnapshot } from "./timeline-cache.js";
import { ServiceError } from "./errors.js";
import { renderMarkdown, renderViewerHtml, startViewerServer, type ViewerBindingContext, type ViewerNavigationCatalog, type ViewerNavigationRoom, type ViewerNavigationSyncResult, type ViewerNavigationTeam, type ViewerReadIdentity, type ViewerRefreshResult, type ViewerRoomPage } from "../viewer/server.js";
import { getAllUnreadInboxEntries, getInboxReadCursor } from "./inbox.js";
import { getRoomPublishMode } from "./publish-policy.js";
import { dashboardStatus, invalidateDashboard } from "./dashboard.js";
import { getUiLanguage, setUiLanguage } from "./ui-preferences.js";

export interface ViewerSession {
  formatVersion: 1;
  sessionId: string;
  forumAlias: string;
  roomId: string;
  identityId?: string;
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

/**
 * 探测 Viewer HTTP server 是否仍可到达。
 * Windows 上 process.kill(pid, 0) 对已死进程可能误判为存活，
 * 此时以 HTTP 连接是否被拒绝作为兜底判据：连接失败即认为会话已死。
 */
async function isServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(1_500),
    });
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
    if (session && await isProcessAlive(session.pid) && await isServerReachable(session.url)) sessions.push(session);
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
    if (!session || !(await isProcessAlive(session.pid)) || !(await isServerReachable(session.url))) {
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

    // 进程存活判断在 Windows 上对已死进程可能误判；HTTP server 不可达时同样视为会话已死。
    if (!(await isProcessAlive(session.pid)) || !(await isServerReachable(session.url))) {
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

async function getViewerReadIdentities(forumAlias: string, identityIds: Array<string | undefined>, paths: AgentForumPaths): Promise<ViewerReadIdentity[]> {
  const unique = [...new Set(identityIds)];
  const config = await loadLocalConfig(paths);
  return Promise.all(unique.map(async (identityId) => {
    const cursor = await getInboxReadCursor({ forumAlias, ...(identityId ? { identityId } : {}) }, paths);
    const profile = config.identities.find((identity) => identity.memberId === cursor.memberId);
    return { memberId: cursor.memberId, displayName: profile?.displayName ?? cursor.memberId, seenIds: cursor.seenIds };
  }));
}

/**
 * 构建 Viewer 房间导航目录，只读取本机缓存，不触发远端同步。
 * Team 来源是本机已注册 Forum，Active 来源是仍有效的 Dashboard 客户端租约。
 */
export async function getViewerNavigationCatalog(
  identityId: string | undefined,
  paths = createAgentForumPaths(),
): Promise<ViewerNavigationCatalog> {
  const config = await loadLocalConfig(paths);
  let activeClients: Array<{ forumId: string; roomId: string }> = [];
  try {
    activeClients = (await dashboardStatus(paths)).clients;
  } catch {
    // Dashboard 本地运行状态损坏时，Viewer 仍应保留只读导航能力，只隐藏 Active 标记。
  }
  const teams = await Promise.all(config.forums.map(async (registration): Promise<ViewerNavigationTeam> => {
    const clients = activeClients.filter((client) => client.forumId === registration.forumId);
    try {
      const cached = await getForumSnapshot(registration.alias, paths);
      const snapshot = cached.snapshot;
      const rooms = new Map<string, ViewerNavigationRoom>(snapshot.rooms.map((cachedRoom) => [cachedRoom.room.id, {
        roomId: cachedRoom.room.id,
        slug: cachedRoom.room.slug,
        title: cachedRoom.room.title,
        status: cachedRoom.room.status,
        deprecated: Boolean(cachedRoom.room.deprecation),
        activeLocalAgents: clients.filter((client) => client.roomId === cachedRoom.room.id).length,
        counts: { related: 0, broadcast: 0, other: 0 },
      }]));
      const closedThreadIds = new Set(snapshot.rooms.flatMap((cachedRoom) => cachedRoom.threads.filter((thread) => thread.thread.status === "closed").map((thread) => thread.thread.id)));
      const identities = await getViewerReadIdentities(registration.alias, [identityId], paths);
      const identity = identities[0];
      if (identity) {
        const inbox = await getAllUnreadInboxEntries({ forumAlias: registration.alias, identityId: identity.memberId }, paths);
        const seen = new Set<string>();
        for (const entry of inbox.entries) {
          if (entry.threadId && closedThreadIds.has(entry.threadId)) continue;
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          const room = rooms.get(entry.roomId);
          if (!room) continue;
          if (entry.relevance === "direct" || entry.relevance === "watched") room.counts.related += 1;
          else if (entry.audience === "broadcast") room.counts.broadcast += 1;
          else room.counts.other += 1;
        }
      }
      const orderedRooms = [...rooms.values()].sort((left, right) => Number(left.deprecated) - Number(right.deprecated) || right.activeLocalAgents - left.activeLocalAgents || (right.counts.related * 12 + right.counts.broadcast * 3 + right.counts.other) - (left.counts.related * 12 + left.counts.broadcast * 3 + left.counts.other) || left.title.localeCompare(right.title));
      const counts = orderedRooms.reduce((total, room) => ({ related: total.related + room.counts.related, broadcast: total.broadcast + room.counts.broadcast, other: total.other + room.counts.other }), { related: 0, broadcast: 0, other: 0 });
      return { forumId: registration.forumId, forumAlias: registration.alias, name: snapshot.forum.name || registration.alias, activeLocalAgents: clients.length, counts, rooms: orderedRooms };
    } catch (error) {
      const code = error instanceof ServiceError ? error.code : "CACHE_UNAVAILABLE";
      return { forumId: registration.forumId, forumAlias: registration.alias, name: registration.alias, activeLocalAgents: clients.length, counts: { related: 0, broadcast: 0, other: 0 }, rooms: [], error: `Unable to read Team data (${code}).` };
    }
  }));
  return { teams: teams.sort((left, right) => left.name.localeCompare(right.name)), generatedAt: new Date().toISOString() };
}

/**
 * 主动同步一个 Team 后重新读取整个导航目录；其他 Team 只读取缓存，不同步。
 */
export async function syncViewerNavigationTeam(
  forumAlias: string,
  identityId: string | undefined,
  paths = createAgentForumPaths(),
): Promise<ViewerNavigationSyncResult> {
  let freshness: { state: "fresh" | "stale"; message?: string } = { state: "fresh" };
  try {
    const result = await refreshForumFromRemote(forumAlias, paths);
    if (result.outcome === "remote-not-configured") freshness = { state: "stale", message: "No remote is configured for this Team; latest remote content cannot be verified." };
    else if (result.outcome === "skipped-local-commits") freshness = { state: "stale", message: "Local commits are not pushed; remote refresh was safely skipped." };
    else if (result.outcome === "updated") await invalidateDashboard(paths);
  } catch (error) {
    const code = error instanceof ServiceError ? error.code : "SYNC_FAILED";
    freshness = { state: "stale", message: `Remote sync failed (${code}).` };
  }
  return { catalog: await getViewerNavigationCatalog(identityId, paths), freshness };
}

/**
 * 对指定 Forum 执行一次只拉取同步，并将失败保留为 stale 结果。
 */
async function refreshViewerForum(
  forumAlias: string,
  identityId: string | undefined,
  paths: AgentForumPaths,
): Promise<ViewerRefreshResult> {
  try {
    const result = await refreshForumFromRemote(forumAlias, paths);
    if (result.outcome === "remote-not-configured") return { freshness: { state: "stale", message: "No remote is configured for this Team; latest remote content cannot be verified." } };
    if (result.outcome === "skipped-local-commits") return { freshness: { state: "stale", message: "Local commits are not pushed; remote refresh was safely skipped." } };
    if (result.outcome === "updated") await invalidateDashboard(paths);
    return { snapshot: (await getForumSnapshot(forumAlias, paths)).snapshot, freshness: { state: "fresh" }, readIdentities: await getViewerReadIdentities(forumAlias, [identityId], paths) };
  } catch (error) {
    const code = error instanceof ServiceError ? error.code : "SYNC_FAILED";
    return { freshness: { state: "stale", message: `Remote sync failed (${code}).` } };
  }
}

export async function runViewerServer(input: {
  forumAlias: string;
  room: string;
  sessionId: string;
  token: string;
  idleMs: number;
  identityId?: string;
  openBrowser?: boolean;
  binding?: ViewerBindingContext;
}, paths = createAgentForumPaths()): Promise<void> {
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, input.forumAlias);
  const cached = await getForumSnapshot(input.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === input.room || item.room.slug === input.room);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${input.room}`);
  const readIdentities = await getViewerReadIdentities(input.forumAlias, [input.identityId], paths);
  const navigation = await getViewerNavigationCatalog(input.identityId, paths);
  const loadRoom = async (forumAlias: string, roomId: string): Promise<ViewerRoomPage> => {
    const initial = await getForumSnapshot(forumAlias, paths);
    let targetSnapshot = initial.snapshot;
    let targetFreshness: ViewerRefreshResult["freshness"] = { state: "stale", message: "Remote sync did not complete." };
    let targetIdentities = await getViewerReadIdentities(forumAlias, [input.identityId], paths);
    const refreshed = await refreshViewerForum(forumAlias, input.identityId, paths);
    targetFreshness = refreshed.freshness;
    if (refreshed.snapshot) targetSnapshot = refreshed.snapshot;
    if (refreshed.readIdentities) targetIdentities = refreshed.readIdentities;
    const targetRoom = targetSnapshot.rooms.find((item) => item.room.id === roomId || item.room.slug === roomId);
    if (!targetRoom) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${roomId}`);
    const targetForum = findForum(await loadLocalConfig(paths), forumAlias);
    return {
      forumAlias,
      roomId: targetRoom.room.id,
      snapshot: targetSnapshot,
      room: targetRoom,
      freshness: targetFreshness,
      readIdentities: targetIdentities,
      sendMode: await getRoomPublishMode(paths, targetForum.forumId, targetRoom.room.id),
    };
  };
  const server = await startViewerServer({
    snapshot: cached.snapshot,
    roomIdOrSlug: room.room.id,
    token: input.token,
    idleMs: input.idleMs,
    readIdentities,
    language: await getUiLanguage(paths),
    sendMode: await getRoomPublishMode(paths, forum.forumId, room.room.id),
    navigation,
    loadRoom,
    syncNavigation: (forumAlias) => syncViewerNavigationTeam(forumAlias, input.identityId, paths),
    ...(input.binding ? { binding: input.binding } : {}),
    setLanguage: async (language) => { await setUiLanguage(language, paths); },
    refresh: () => refreshViewerForum(input.forumAlias, input.identityId, paths),
  });
  const session: ViewerSession = {
    formatVersion: 1,
    sessionId: input.sessionId,
    forumAlias: input.forumAlias,
    roomId: room.room.id,
    ...(input.identityId ? { identityId: input.identityId } : {}),
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

export async function launchViewerInline(input: { forumAlias: string; room: string; identityId?: string; idleMs?: number; cwd?: string }, paths = createAgentForumPaths()): Promise<void> {
  const resolved = await resolveViewerTarget({ forumAlias: input.forumAlias, room: input.room, ...(input.cwd ? { cwd: input.cwd } : {}) }, paths);
  const context = resolved.context;
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  await replaceViewerSessions(context.forumAlias, context.roomId, paths);
  await runViewerServer({
    forumAlias: context.forumAlias,
    room: context.roomId,
    sessionId: randomUUID(),
    token: randomBytes(16).toString("hex"),
    idleMs: input.idleMs ?? 30 * 60_000,
    ...(input.identityId ? { identityId: input.identityId } : {}),
    ...(resolved.binding ? { binding: resolved.binding } : {}),
    openBrowser: true,
  }, paths);
}

export function viewerServerLaunchArgs(entryPath: string | undefined, commandArgs: readonly string[], executablePath = process.execPath): string[] {
  if (!entryPath) throw new ServiceError("VIEWER_START_FAILED", "CLI entry path is unavailable");
  // Deno compile 产物的 argv[1] 就是自身可执行文件；再次传入会被 CLI 当作未知子命令。
  return resolve(entryPath) === resolve(executablePath) ? [...commandArgs] : [entryPath, ...commandArgs];
}

/**
 * 解析 Viewer 目标并尽量保留与当前目标一致的本机绑定信息。
 * 显式 Forum/Room 只决定展示目标，不应在目标与当前绑定一致时丢弃目录和分支。
 */
async function resolveViewerTarget(
  input: { forumAlias?: string; room?: string; cwd?: string },
  paths: AgentForumPaths,
): Promise<{ context: ResolvedContextView; binding?: ViewerBindingContext }> {
  const context = await resolveContext({
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}),
    ...(input.room ? { room: input.room } : {}),
  }, paths);
  if (context.context) {
    return {
      context,
      binding: { workspaceRoot: context.context.workspaceRoot, branch: context.context.branch },
    };
  }
  if (!input.forumAlias || !input.room) return { context };
  try {
    const bound = await resolveContext({ ...(input.cwd ? { cwd: input.cwd } : {}) }, paths);
    if (bound.forumId === context.forumId && bound.roomId === context.roomId && bound.context) {
      return {
        context,
        binding: { workspaceRoot: bound.context.workspaceRoot, branch: bound.context.branch },
      };
    }
  } catch (error) {
    if (!(error instanceof ContextError) || !["CONTEXT_NOT_BOUND", "BINDING_TARGET_UNAVAILABLE"].includes(error.code)) {
      throw error;
    }
  }
  return { context };
}

export async function openViewer(input: {
  forumAlias?: string;
  room?: string;
  cwd?: string;
  openBrowser?: boolean;
  idleMs?: number;
  identityId?: string;
  entryPath?: string;
}, paths = createAgentForumPaths()): Promise<ViewerSession & { browserOpened: boolean; replacedSessionIds: string[] }> {
  const resolved = await resolveViewerTarget(input, paths);
  const context = resolved.context;
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
    const binding = resolved.binding;
    const args = viewerServerLaunchArgs(entryPath, ["viewer", "serve", "--forum", context.forumAlias, "--room", context.roomId, "--session", sessionId, "--token", token, "--idle-ms", String(input.idleMs ?? 30 * 60_000), "--home", dirname(paths.root), ...(input.identityId ? ["--identity", input.identityId] : []), ...(binding ? ["--workspace", binding.workspaceRoot, ...(binding.branch ? ["--branch", binding.branch] : [])] : [])]);
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

export interface ViewerLocalReceipt {
  publishedBy: Array<{ id: string; displayName: string }>;
  readBy: Array<{ id: string; displayName: string }>;
  unreadBy: Array<{ id: string; displayName: string }>;
}

export interface ViewerRoomData {
  freshness: ReadFreshness;
  room: { id: string; slug: string; title: string; description: string; status: string; sendMode: "auto" | "ask" };
  forum: { alias: string; name: string; dataBranch: string };
  syncedAt: string;
  stats: { threadCount: number; messageCount: number; memberCount: number };
  threads: Array<{
    id: string; title: string; kind: string; status: string;
    authorId: string; authorName: string; replyCount: number; lastActivityAt: string;
    messages: Array<{ id: string; authorId: string; authorName: string; type: string; body: string; bodyHtml: string; replyTo: string | null; mentions: string[]; repliesToMe: boolean; mentionsMe: boolean; createdAt: string; localReceipt: ViewerLocalReceipt }>;
  }>;
  members: Array<{ id: string; displayName: string; role: string; messageCount: number; lastMessageAt: string | null }>;
}

// 为 Dashboard 房间面板提供结构化 JSON 数据，不启动 HTTP server 或子进程。
export async function getViewerRoomData(input: { forumAlias?: string; room?: string; cwd?: string; identityIds?: string[] }, paths = createAgentForumPaths()): Promise<ViewerRoomData> {
  const context = await resolveContext({ ...(input.cwd ? { cwd: input.cwd } : {}), ...(input.forumAlias ? { forumAlias: input.forumAlias } : {}), ...(input.room ? { room: input.room } : {}) }, paths);
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const freshness = await refreshForRead(context.forumAlias, {}, paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId || item.room.slug === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  const snapshot = cached.snapshot;
  const readIdentities = await getViewerReadIdentities(context.forumAlias, input.identityIds?.length ? input.identityIds : [undefined], paths);
  // 收敛 Message 的本机 receipt；关闭主题保留发布/已读历史，但不产生未读导航目标。
  const localReceipt = (item: { id: string; authorId: string; createdAt: string }, trackUnread = true): ViewerLocalReceipt => {
    const publishedBy = readIdentities.filter((identity) => identity.memberId === item.authorId);
    const recipients = readIdentities.filter((identity) => {
      if (identity.memberId === item.authorId) return false;
      const membership = room.members[identity.memberId];
      return membership?.status === "active";
    });
    const seen = new Map(readIdentities.map((identity) => [identity.memberId, new Set(identity.seenIds)]));
    const summary = (identity: ViewerReadIdentity) => ({ id: identity.memberId, displayName: identity.displayName });
    return {
      publishedBy: publishedBy.map(summary),
      readBy: recipients.filter((identity) => seen.get(identity.memberId)?.has(item.id)).map(summary),
      unreadBy: trackUnread ? recipients.filter((identity) => !seen.get(identity.memberId)?.has(item.id)).map(summary) : [],
    };
  };
  // 聚合成员活跃度：统计每个 Room 成员在本房间的消息数和最后发言时间
  const memberStats = new Map<string, { messageCount: number; lastMessageAt: string | null }>();
  const activeMemberIds = Object.entries(room.members).filter(([, m]) => m.status === "active").map(([id]) => id);
  for (const id of activeMemberIds) memberStats.set(id, { messageCount: 0, lastMessageAt: null });
  // "我" = 当前查看的 identities；"回复我"/"@我" 均排除自己发布的消息。
  const meIds = new Set(readIdentities.map((identity) => identity.memberId));
  let totalMessages = 0;
  const threads = room.threads.map((cachedThread) => {
    const messages = cachedThread.timeline.filter((item): item is Extract<typeof item, { kind: "message" }> => item.kind === "message");
    const replyCount = messages.filter((m) => m.replyTo).length;
    let lastActivityAt = cachedThread.thread.createdAt;
    const authorByMessageId = new Map(messages.map((m) => [m.id, m.authorId]));
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
      messages: messages.map((msg) => {
        const authoredByMe = meIds.has(msg.authorId);
        const targetAuthorId = msg.replyTo ? authorByMessageId.get(msg.replyTo) : undefined;
        return {
          id: msg.id, authorId: msg.authorId, authorName: snapshot.members[msg.authorId]?.displayName ?? msg.authorId,
          type: msg.type, body: msg.body, bodyHtml: renderMarkdown(msg.body), replyTo: msg.replyTo ?? null,
          mentions: [...msg.mentions],
          repliesToMe: Boolean(targetAuthorId && meIds.has(targetAuthorId) && !authoredByMe),
          mentionsMe: msg.mentions.some((id) => meIds.has(id)) && !authoredByMe,
          createdAt: msg.createdAt, localReceipt: localReceipt(msg, cachedThread.thread.status !== "closed"),
        };
      }),
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
    room: { id: room.room.id, slug: room.room.slug, title: room.room.title, description: room.room.description, status: room.room.status, sendMode: await getRoomPublishMode(paths, findForum(await loadLocalConfig(paths), snapshot.forumAlias).forumId, room.room.id) },
    forum: { alias: snapshot.forumAlias, name: snapshot.forum.name, dataBranch: findForum(await loadLocalConfig(paths), snapshot.forumAlias).dataBranch },
    syncedAt: snapshot.generatedAt,
    stats: { threadCount: threads.length, messageCount: totalMessages, memberCount: members.length },
    threads, members,
  };
}

export async function generateViewerHtml(input: { forumAlias?: string; room?: string; cwd?: string; output?: string; identityId?: string }, paths = createAgentForumPaths()): Promise<{ output: string }> {
  const resolved = await resolveViewerTarget(input, paths);
  const context = resolved.context;
  if (!context.forumAlias) throw new ServiceError("VIEWER_START_FAILED", "resolved forum is unavailable");
  const refresh = await refreshForumFromRemote(context.forumAlias, paths);
  if (refresh.outcome === "updated") await invalidateDashboard(paths);
  const cached = await getForumSnapshot(context.forumAlias, paths);
  const output = input.output ?? resolve(paths.viewerDirectory, `${context.roomId}.html`);
  const room = cached.snapshot.rooms.find((item) => item.room.id === context.roomId);
  if (!room) throw new ServiceError("ROOM_NOT_FOUND", `Room not found: ${context.roomId}`);
  await mkdir(dirname(output), { recursive: true });
  const html = renderViewerHtml(cached.snapshot, room, { state: "fresh" }, await getViewerReadIdentities(context.forumAlias, [input.identityId], paths), await getUiLanguage(paths), resolved.binding, await getRoomPublishMode(paths, findForum(await loadLocalConfig(paths), context.forumAlias).forumId, room.room.id));
  await import("node:fs/promises").then(({ writeFile }) => writeFile(output, html, { encoding: "utf8", mode: 0o600 }));
  return { output };
}
