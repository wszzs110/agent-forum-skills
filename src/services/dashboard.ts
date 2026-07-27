import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findForum, findIdentity, loadLocalConfig } from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
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
  /** 首次连接本次 Dashboard 的时间；仅用于标识本次会话中的本人新消息。 */
  attachedAt?: string;
  expiresAt: string;
}

interface DashboardRuntime {
  formatVersion: 1;
  clients: DashboardClient[];
  pollingForumIds: string[];
  pinnedRoomIds: string[];
  revision: number;
  updatedAt: string;
}

function emptyRuntime(): DashboardRuntime {
  return { formatVersion: 1, clients: [], pollingForumIds: [], pinnedRoomIds: [], revision: 0, updatedAt: currentUtcTimestamp() };
}

function validClient(value: unknown): value is DashboardClient {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.clientId === "string" && clientIdPattern.test(item.clientId) &&
    typeof item.clientType === "string" && clientTypes.has(item.clientType) &&
    typeof item.forumAlias === "string" && typeof item.forumId === "string" &&
    typeof item.roomId === "string" && typeof item.identityId === "string" &&
    (item.attachedAt === undefined || (typeof item.attachedAt === "string" && !Number.isNaN(Date.parse(item.attachedAt)))) &&
    typeof item.expiresAt === "string" && !Number.isNaN(Date.parse(item.expiresAt));
}

async function loadRuntime(paths: AgentForumPaths): Promise<DashboardRuntime> {
  try {
    const value = JSON.parse(await readFile(paths.dashboardRuntimeFile, "utf8")) as Partial<DashboardRuntime>;
    if (value.formatVersion !== 1 || !Array.isArray(value.clients) || !value.clients.every(validClient) ||
      !Array.isArray(value.pollingForumIds) || !value.pollingForumIds.every((id) => typeof id === "string") ||
      !Array.isArray(value.pinnedRoomIds) || !value.pinnedRoomIds.every((id) => typeof id === "string")) {
      throw new ServiceError("PROTOCOL_DATA_DAMAGED", "Dashboard runtime state is invalid");
    }
    return { formatVersion: 1, clients: value.clients, pollingForumIds: value.pollingForumIds, pinnedRoomIds: value.pinnedRoomIds, revision: Number.isSafeInteger(value.revision) && value.revision! >= 0 ? value.revision! : 0, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : currentUtcTimestamp() };
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
  clientId: string; clientType: DashboardClient["clientType"]; forumAlias: string; roomId: string; identityId?: string; leaseMs?: number;
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
    if (!previous || previous.clientType !== client.clientType || previous.forumId !== client.forumId || previous.roomId !== client.roomId || previous.identityId !== client.identityId) runtime.revision += 1;
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

export async function dashboardStatus(paths = createAgentForumPaths()): Promise<{ clients: DashboardClient[]; pollingForumIds: string[]; pinnedRoomIds: string[]; revision: number }> {
  const runtime = await loadRuntime(paths);
  const activeClients = active(runtime);
  if (activeClients.length !== runtime.clients.length) {
    return mutateRuntime("dashboard status", paths, (current) => ({ clients: current.clients, pollingForumIds: current.pollingForumIds, pinnedRoomIds: current.pinnedRoomIds, revision: current.revision }));
  }
  return { clients: activeClients, pollingForumIds: runtime.pollingForumIds, pinnedRoomIds: runtime.pinnedRoomIds, revision: runtime.revision };
}

export async function invalidateDashboard(paths = createAgentForumPaths()): Promise<void> {
  await mutateRuntime("dashboard invalidate", paths, (runtime) => {
    if (runtime.clients.length > 0) runtime.revision += 1;
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

export async function getDashboardSnapshot(paths = createAgentForumPaths()): Promise<{ revision: number; teams: Array<{ forumId: string; forumAlias: string; polling: boolean; counts: { related: number; broadcast: number; other: number }; rooms: Array<{ roomId: string; title: string; counts: { related: number; broadcast: number; other: number }; activeLocalAgents: number; pinned: boolean }> }>; activeClients: number }> {
  const runtime = await dashboardStatus(paths);
  const teams = new Map<string, DashboardClient[]>();
  for (const client of runtime.clients) teams.set(client.forumId, [...(teams.get(client.forumId) ?? []), client]);
  const result = [];
  for (const [forumId, clients] of teams) {
    const alias = clients[0]!.forumAlias;
    const snapshot = (await getForumSnapshot(alias, paths)).snapshot;
    const byRoom = new Map(snapshot.rooms.map((room) => [room.room.id, { roomId: room.room.id, title: room.room.title, counts: { related: 0, broadcast: 0, other: 0 }, activeLocalAgents: clients.filter((client) => client.roomId === room.room.id).length, pinned: runtime.pinnedRoomIds.includes(room.room.id), status: room.room.status, threads: new Map(room.threads.map((thread) => [thread.thread.id, thread.thread.status])) }]));
    const seen = new Set<string>();
    for (const identityId of new Set(clients.map((client) => client.identityId))) {
      const inbox = await getAllUnreadInboxEntries({ forumAlias: alias, identityId }, paths);
      for (const entry of inbox.entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        const room = byRoom.get(entry.roomId);
        if (!room) continue;
        if (entry.relevance === "direct" || entry.relevance === "watched") room.counts.related += 1;
        else if (entry.audience === "broadcast") room.counts.broadcast += 1;
        else if (!entry.threadId || room.threads.get(entry.threadId) === "open") room.counts.other += 1;
      }
    }
    const attachedAtByIdentity = new Map<string, string>();
    for (const client of clients) {
      const attachedAt = client.attachedAt ?? client.expiresAt;
      const current = attachedAtByIdentity.get(client.identityId);
      if (!current || attachedAt < current) attachedAtByIdentity.set(client.identityId, attachedAt);
    }
    for (const sourceRoom of snapshot.rooms) {
      const room = byRoom.get(sourceRoom.room.id);
      if (!room) continue;
      for (const thread of sourceRoom.threads) {
        for (const item of thread.timeline) {
          if (item.kind === "message" && attachedAtByIdentity.get(item.authorId) !== undefined && item.createdAt >= attachedAtByIdentity.get(item.authorId)!) room.counts.other += 1;
        }
      }
    }
    const allRooms = [...byRoom.values()].map(({ status: _status, threads: _threads, ...room }) => room);
    const counts = allRooms.reduce((total, room) => ({ related: total.related + room.counts.related, broadcast: total.broadcast + room.counts.broadcast, other: total.other + room.counts.other }), { related: 0, broadcast: 0, other: 0 });
    const rooms = allRooms.sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.activeLocalAgents - left.activeLocalAgents || (right.counts.related * 12 + right.counts.broadcast * 3 + right.counts.other) - (left.counts.related * 12 + left.counts.broadcast * 3 + left.counts.other) || left.title.localeCompare(right.title));
    result.push({ forumId, forumAlias: alias, polling: runtime.pollingForumIds.includes(forumId), counts, rooms });
  }
  return { revision: runtime.revision, teams: result.sort((a, b) => a.forumAlias.localeCompare(b.forumAlias)), activeClients: runtime.clients.length };
}
