import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findForum, findIdentity, loadLocalConfig } from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { loadContextBindingState } from "../context/bindings.js";
import { ServiceError } from "./errors.js";
import { getAllUnreadInboxEntries } from "./inbox.js";
import { getForumSnapshot } from "./timeline-cache.js";

const clientIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const clientTypes = new Set(["pi", "opencode", "codex", "claude-code"]);

export interface DashboardClient {
  clientId: string;
  clientType: "pi" | "opencode" | "codex" | "claude-code";
  forumAlias: string;
  forumId: string;
  roomId: string;
  identityId: string;
  attachedAt?: string;
  expiresAt: string;
}

export interface DashboardViewTarget {
  forumAlias: string;
  forumId: string;
  roomId: string;
  identityId: string;
}

export interface DashboardRoomBinding {
  workspaceRoot: string;
  branch: string | null;
}

interface DashboardRuntime {
  formatVersion: 1;
  clients: DashboardClient[];
  viewTargets: DashboardViewTarget[];
  pollingForumIds: string[];
  pinnedRoomIds: string[];
  revision: number;
  updatedAt: string;
}

function emptyRuntime(): DashboardRuntime {
  return { formatVersion: 1, clients: [], viewTargets: [], pollingForumIds: [], pinnedRoomIds: [], revision: 0, updatedAt: currentUtcTimestamp() };
}

function validViewTarget(value: unknown): value is DashboardViewTarget {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.forumAlias === "string" && typeof item.forumId === "string" &&
    typeof item.roomId === "string" && typeof item.identityId === "string";
}

function validClient(value: unknown): value is DashboardClient {
  if (!validViewTarget(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  return typeof item.clientId === "string" && clientIdPattern.test(item.clientId) &&
    typeof item.clientType === "string" && clientTypes.has(item.clientType) &&
    (item.attachedAt === undefined || (typeof item.attachedAt === "string" && !Number.isNaN(Date.parse(item.attachedAt)))) &&
    typeof item.expiresAt === "string" && !Number.isNaN(Date.parse(item.expiresAt));
}

async function loadRuntime(paths: AgentForumPaths): Promise<DashboardRuntime> {
  try {
    const value = JSON.parse(await readFile(paths.dashboardRuntimeFile, "utf8")) as Partial<DashboardRuntime>;
    if (value.formatVersion !== 1 || !Array.isArray(value.clients) || !value.clients.every(validClient) ||
      (value.viewTargets !== undefined && (!Array.isArray(value.viewTargets) || !value.viewTargets.every(validViewTarget))) ||
      !Array.isArray(value.pollingForumIds) || !value.pollingForumIds.every((id) => typeof id === "string") ||
      !Array.isArray(value.pinnedRoomIds) || !value.pinnedRoomIds.every((id) => typeof id === "string")) {
      throw new ServiceError("PROTOCOL_DATA_DAMAGED", "Dashboard runtime state is invalid");
    }
    const viewTargets = value.viewTargets ?? value.clients.map(({ forumAlias, forumId, roomId, identityId }) => ({ forumAlias, forumId, roomId, identityId }));
    return { formatVersion: 1, clients: value.clients, viewTargets, pollingForumIds: value.pollingForumIds, pinnedRoomIds: value.pinnedRoomIds, revision: Number.isSafeInteger(value.revision) && value.revision! >= 0 ? value.revision! : 0, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : currentUtcTimestamp() };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return emptyRuntime();
    throw error;
  }
}

function active(runtime: DashboardRuntime, now = Date.now()): DashboardClient[] {
  return runtime.clients.filter((client) => Date.parse(client.expiresAt) > now);
}

async function mutateRuntime<T>(command: string, paths: AgentForumPaths, mutate: (runtime: DashboardRuntime) => T): Promise<T> {
  const lock = await acquireForumLock({ lockPath: resolve(paths.locksDirectory, "dashboard.lock"), command });
  try {
    const runtime = await loadRuntime(paths);
    const activeClients = active(runtime);
    if (activeClients.length !== runtime.clients.length) runtime.revision += 1;
    runtime.clients = activeClients;
    const result = mutate(runtime);
    runtime.updatedAt = currentUtcTimestamp();
    await writeJsonAtomic(paths.dashboardRuntimeFile, runtime, { overwrite: true, mode: 0o600 });
    return result;
  } finally { await lock.release(); }
}

export async function attachDashboardClient(input: {
  clientId: string; clientType: DashboardClient["clientType"]; forumAlias: string; roomId: string; identityId?: string; leaseMs?: number; resetView?: boolean;
}, paths = createAgentForumPaths()): Promise<{ client: DashboardClient; activeClients: number }> {
  if (!clientIdPattern.test(input.clientId) || !clientTypes.has(input.clientType)) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "invalid Dashboard client identity");
  const leaseMs = input.leaseMs ?? 45_000;
  if (!Number.isInteger(leaseMs) || leaseMs < 5_000 || leaseMs > 5 * 60_000) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "Dashboard lease must be between 5 seconds and 5 minutes");
  const config = await loadLocalConfig(paths);
  const forum = findForum(config, input.forumAlias);
  const identity = findIdentity(config, input.identityId);
  const attachedAt = new Date().toISOString();
  const client: DashboardClient = { clientId: input.clientId, clientType: input.clientType, forumAlias: forum.alias, forumId: forum.forumId, roomId: input.roomId, identityId: identity.memberId, attachedAt, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
  return mutateRuntime("dashboard attach", paths, (runtime) => {
    const previous = runtime.clients.find((item) => item.clientId === client.clientId);
    if (previous?.attachedAt) client.attachedAt = previous.attachedAt;
    runtime.clients = [...runtime.clients.filter((item) => item.clientId !== client.clientId), client];
    const target = { forumAlias: client.forumAlias, forumId: client.forumId, roomId: client.roomId, identityId: client.identityId };
    if (input.resetView) runtime.viewTargets = runtime.clients.map(({ forumAlias, forumId, roomId, identityId }) => ({ forumAlias, forumId, roomId, identityId }));
    const targetKey = (item: DashboardViewTarget) => `${item.forumId}\0${item.roomId}\0${item.identityId}`;
    runtime.viewTargets = [...runtime.viewTargets.filter((item) => targetKey(item) !== targetKey(target)), target];
    if (input.resetView || !previous || previous.clientType !== client.clientType || previous.forumId !== client.forumId || previous.roomId !== client.roomId || previous.identityId !== client.identityId) runtime.revision += 1;
    return { client, activeClients: runtime.clients.length };
  });
}

export async function detachDashboardClient(clientId: string, paths = createAgentForumPaths()): Promise<{ detached: boolean; activeClients: number }> {
  return mutateRuntime("dashboard detach", paths, (runtime) => {
    const before = runtime.clients.length;
    runtime.clients = runtime.clients.filter((item) => item.clientId !== clientId);
    if (before !== runtime.clients.length) runtime.revision += 1;
    return { detached: before !== runtime.clients.length, activeClients: runtime.clients.length };
  });
}

export async function dashboardStatus(paths = createAgentForumPaths()): Promise<{ clients: DashboardClient[]; viewTargets: DashboardViewTarget[]; pollingForumIds: string[]; pinnedRoomIds: string[]; revision: number }> {
  const runtime = await loadRuntime(paths);
  const activeClients = active(runtime);
  if (activeClients.length !== runtime.clients.length) {
    return mutateRuntime("dashboard status", paths, (current) => ({ clients: current.clients, viewTargets: current.viewTargets, pollingForumIds: current.pollingForumIds, pinnedRoomIds: current.pinnedRoomIds, revision: current.revision }));
  }
  return { clients: activeClients, viewTargets: runtime.viewTargets, pollingForumIds: runtime.pollingForumIds, pinnedRoomIds: runtime.pinnedRoomIds, revision: runtime.revision };
}

export async function invalidateDashboard(paths = createAgentForumPaths()): Promise<void> {
  await mutateRuntime("dashboard invalidate", paths, (runtime) => {
    // 可见 Dashboard 在最后一个 lease 消失后仍继续运行；只要还有展示上下文就必须刷新。
    if (runtime.viewTargets.length > 0) runtime.revision += 1;
  });
}

export async function setDashboardForumPolling(forumId: string, enabled: boolean, paths = createAgentForumPaths()): Promise<{ forumId: string; enabled: boolean }> {
  return mutateRuntime("dashboard polling", paths, (runtime) => {
    runtime.pollingForumIds = enabled ? [...new Set([...runtime.pollingForumIds, forumId])] : runtime.pollingForumIds.filter((id) => id !== forumId);
    runtime.revision += 1;
    return { forumId, enabled };
  });
}

export async function setDashboardRoomPinned(roomId: string, pinned: boolean, paths = createAgentForumPaths()): Promise<{ roomId: string; pinned: boolean }> {
  return mutateRuntime("dashboard pin", paths, (runtime) => {
    runtime.pinnedRoomIds = pinned ? [...new Set([...runtime.pinnedRoomIds, roomId])] : runtime.pinnedRoomIds.filter((id) => id !== roomId);
    runtime.revision += 1;
    return { roomId, pinned };
  });
}

export async function getDashboardSnapshot(paths = createAgentForumPaths()): Promise<{ revision: number; teams: Array<{ forumId: string; forumAlias: string; polling: boolean; identityIds: string[]; counts: { related: number; broadcast: number; other: number }; rooms: Array<{ roomId: string; title: string; counts: { related: number; broadcast: number; other: number }; activeLocalAgents: number; pinned: boolean; deprecated: boolean; bindings: DashboardRoomBinding[] }> }>; activeClients: number }> {
  const runtime = await dashboardStatus(paths);
  const bindingState = await loadContextBindingState(paths);
  const bindingsByRoom = new Map<string, DashboardRoomBinding[]>();
  for (const binding of bindingState.bindings) {
    const key = `${binding.forumId}\0${binding.roomId}`;
    const current = bindingsByRoom.get(key) ?? [];
    current.push({ workspaceRoot: binding.workspaceRoot, branch: binding.scope === "branch" ? binding.branch : null });
    bindingsByRoom.set(key, current);
  }
  for (const bindings of bindingsByRoom.values()) {
    bindings.sort((left, right) => left.workspaceRoot.localeCompare(right.workspaceRoot) || (left.branch ?? "").localeCompare(right.branch ?? ""));
  }
  const teams = new Map<string, DashboardViewTarget[]>();
  for (const target of runtime.viewTargets) teams.set(target.forumId, [...(teams.get(target.forumId) ?? []), target]);
  const result = [];
  for (const [forumId, targets] of teams) {
    const alias = targets[0]!.forumAlias;
    const clients = runtime.clients.filter((client) => client.forumId === forumId);
    const snapshot = (await getForumSnapshot(alias, paths)).snapshot;
    const byRoom = new Map(snapshot.rooms.map((room) => [room.room.id, { roomId: room.room.id, title: room.room.title, counts: { related: 0, broadcast: 0, other: 0 }, activeLocalAgents: clients.filter((client) => client.roomId === room.room.id).length, pinned: runtime.pinnedRoomIds.includes(room.room.id), deprecated: Boolean(room.room.deprecation), bindings: bindingsByRoom.get(`${forumId}\0${room.room.id}`) ?? [] }]));
    // Closed Thread 仍可在历史页面阅读，但不再触发 Dashboard 的未读提醒或排序权重。
    const closedThreadIds = new Set(snapshot.rooms.flatMap((room) => room.threads.filter((thread) => thread.thread.status === "closed").map((thread) => thread.thread.id)));
    const seen = new Set<string>();
    const identityIds = [...new Set(targets.map((target) => target.identityId))];
    for (const identityId of identityIds) {
      const inbox = await getAllUnreadInboxEntries({ forumAlias: alias, identityId }, paths);
      for (const entry of inbox.entries) {
        if (entry.threadId && closedThreadIds.has(entry.threadId)) continue;
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        const room = byRoom.get(entry.roomId);
        if (!room) continue;
        if (entry.relevance === "direct" || entry.relevance === "watched") room.counts.related += 1;
        else if (entry.audience === "broadcast") room.counts.broadcast += 1;
        else room.counts.other += 1;
      }
    }
    const allRooms = [...byRoom.values()];
    const counts = allRooms.reduce((total, room) => ({ related: total.related + room.counts.related, broadcast: total.broadcast + room.counts.broadcast, other: total.other + room.counts.other }), { related: 0, broadcast: 0, other: 0 });
    const rooms = allRooms.sort((left, right) => Number(left.deprecated) - Number(right.deprecated) || Number(right.pinned) - Number(left.pinned) || right.activeLocalAgents - left.activeLocalAgents || (right.counts.related * 12 + right.counts.broadcast * 3 + right.counts.other) - (left.counts.related * 12 + left.counts.broadcast * 3 + left.counts.other) || left.title.localeCompare(right.title));
    result.push({ forumId, forumAlias: alias, polling: runtime.pollingForumIds.includes(forumId), identityIds, counts, rooms });
  }
  return { revision: runtime.revision, teams: result.sort((a, b) => a.forumAlias.localeCompare(b.forumAlias)), activeClients: runtime.clients.length };
}
