import { runGit } from "../git/runner.js";
import type { AgentForumPaths } from "../storage/paths.js";
import { listRooms, type ProtocolWarning } from "./room.js";
import { listThreads } from "./thread.js";

export interface SemanticIssue {
  code: string;
  path?: string;
  message: string;
  targetId?: string;
  category?: string;
}

export interface SemanticValidationResult {
  immutableIssues: SemanticIssue[];
  semanticIssues: SemanticIssue[];
}

function lines(value: string): string[] {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function isImmutableProtocolPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized === ".gitattributes" ||
    normalized === ".forum/protocol.json" ||
    normalized === ".forum/forum.json"
  ) {
    return true;
  }
  if (/^\.forum\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/room\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/thread\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/events\/[^/]+\/event\.json$/u.test(normalized)) return true;
  if (/^rooms\/[^/]+\/threads\/[^/]+\/messages\/[^/]+\/(?:message\.json|body\.md)$/u.test(normalized)) return true;
  return false;
}

function modifiedImmutablePaths(
  repository: string,
  from: string | null,
  to: string,
): SemanticIssue[] {
  if (from === to) return [];
  const result = runGit(repository, [
    "log",
    "--format=",
    "--name-only",
    "--diff-filter=MDR",
    from ? `${from}..${to}` : to,
  ]);
  if (result.status !== 0) {
    return [{ code: "HISTORY_INSPECTION_FAILED", message: "could not inspect changed history" }];
  }
  return [...new Set(lines(result.stdout).filter(isImmutableProtocolPath))].map(
    (path) => ({
      code: "IMMUTABLE_PATH_MODIFIED",
      path,
      message: `immutable protocol history modified or deleted: ${path}`,
    }),
  );
}

function warningIssue(warning: ProtocolWarning): SemanticIssue | undefined {
  const blocking = new Set([
    "SCHEMA_VALIDATION_FAILED",
    "PATH_ID_MISMATCH",
    "INVALID_STATE_TRANSITION",
    "EVENT_TARGET_MISMATCH",
    "INVALID_EVENT_DATA",
    "FIRST_MESSAGE_MISSING",
    "FIRST_MESSAGE_TYPE_MISMATCH",
    "FIRST_MESSAGE_AUTHOR_MISMATCH",
    "FIRST_MESSAGE_REPLY_INVALID",
    "REPLY_TARGET_MISSING",
    "MESSAGE_SELF_REPLY",
  ]);
  return blocking.has(warning.code)
    ? { code: warning.code, path: warning.path, message: warning.message }
    : undefined;
}

async function validateCurrentTree(
  forumAlias: string,
  paths: AgentForumPaths,
): Promise<SemanticIssue[]> {
  const result = await listRooms(forumAlias, paths);
  const issues = result.warnings.map(warningIssue).filter(Boolean) as SemanticIssue[];
  const slugs = new Map<string, string[]>();
  for (const room of result.rooms) {
    const ids = slugs.get(room.slug) ?? [];
    ids.push(room.id);
    slugs.set(room.slug, ids);
    const threads = await listThreads(forumAlias, room.id, paths);
    issues.push(
      ...(threads.warnings.map(warningIssue).filter(Boolean) as SemanticIssue[]),
    );
  }
  for (const [slug, roomIds] of slugs) {
    if (roomIds.length > 1) {
      issues.push({
        code: "ROOM_SLUG_CONFLICT",
        message: `room slug is not unique: ${slug}`,
        targetId: roomIds.join(","),
        category: "room-slug",
      });
    }
  }
  const unique = new Map<string, SemanticIssue>();
  for (const issue of issues) {
    unique.set(`${issue.code}\0${issue.path ?? ""}\0${issue.message}`, issue);
  }
  return [...unique.values()];
}

interface EventChange {
  path: string;
  targetId: string;
  category: string;
}

function eventCategory(type: string): string | undefined {
  if (type.endsWith("-renamed")) return "name-or-title";
  if (type.endsWith("-description-changed")) return "description";
  if (
    type.endsWith("-archived") ||
    type.endsWith("-restored") ||
    type.endsWith("-closed") ||
    type.endsWith("-reopened")
  ) return "status";
  return undefined;
}

function addedEvents(repository: string, from: string, to: string): EventChange[] {
  if (from === to) return [];
  const diff = runGit(repository, ["diff", "--name-only", "--diff-filter=A", `${from}..${to}`]);
  if (diff.status !== 0) return [];
  const events: EventChange[] = [];
  for (const path of lines(diff.stdout).filter((item) => item.endsWith("/event.json"))) {
    const shown = runGit(repository, ["show", `${to}:${path}`]);
    if (shown.status !== 0) continue;
    try {
      const event = JSON.parse(shown.stdout) as Record<string, unknown>;
      const category = eventCategory(String(event.type));
      if (category) {
        events.push({ path, targetId: String(event.targetId), category });
      }
    } catch {
      // 当前树 Schema 验证会报告损坏 JSON。
    }
  }
  return events;
}

function concurrentEventIssues(
  repository: string,
  originalRemoteHead: string | null,
  remoteHead: string,
  localHead: string,
): SemanticIssue[] {
  if (!originalRemoteHead) return [];
  const remoteEvents = addedEvents(repository, originalRemoteHead, remoteHead);
  const localEvents = addedEvents(repository, remoteHead, localHead);
  const issues: SemanticIssue[] = [];
  for (const local of localEvents) {
    const remote = remoteEvents.find(
      (candidate) =>
        candidate.targetId === local.targetId &&
        candidate.category === local.category,
    );
    if (remote) {
      issues.push({
        code: "CONCURRENT_FIELD_UPDATE",
        path: local.path,
        message: `remote and local events concurrently update ${local.category} on ${local.targetId}`,
        targetId: local.targetId,
        category: local.category,
      });
    }
  }
  return issues;
}

export async function validateSynchronizedForum(input: {
  forumAlias: string;
  repository: string;
  originalRemoteHead: string | null;
  remoteHead: string;
  localHead: string;
  paths: AgentForumPaths;
}): Promise<SemanticValidationResult> {
  const immutableIssues = [
    ...modifiedImmutablePaths(input.repository, null, input.remoteHead),
    ...modifiedImmutablePaths(input.repository, input.remoteHead, input.localHead),
  ];
  const semanticIssues = [
    ...(await validateCurrentTree(input.forumAlias, input.paths)),
    ...concurrentEventIssues(
      input.repository,
      input.originalRemoteHead,
      input.remoteHead,
      input.localHead,
    ),
  ];
  return { immutableIssues, semanticIssues };
}
