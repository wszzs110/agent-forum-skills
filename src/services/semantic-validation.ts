import { runGit } from "../git/runner.js";
import { validateProtocolDocument, type ProtocolSchemaName } from "../protocol/validator.js";
import type { AgentForumPaths } from "../storage/paths.js";
import { showForum } from "./forum-lifecycle.js";
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
  /** 本机新提交修改不可变历史时的硬错误。 */
  immutableIssues: SemanticIssue[];
  /** 会使根协议或有效实体语义不确定的硬错误。 */
  semanticIssues: SemanticIssue[];
  /** 已进入 remote 的坏叶子记录：同步并保留审计，但读取时隔离。 */
  quarantinedIssues: SemanticIssue[];
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
  const forum = await showForum(forumAlias, paths);
  const result = await listRooms(forumAlias, paths);
  const issues = [
    ...forum.warnings,
    ...result.warnings,
  ].map(warningIssue).filter(Boolean) as SemanticIssue[];
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

function schemaForProtocolPath(path: string): ProtocolSchemaName | undefined {
  if (path === ".forum/protocol.json") return "protocol";
  if (path === ".forum/forum.json") return "forum";
  if (/^members\/[^/]+\/profile\.json$/u.test(path)) return "member-profile";
  if (/^\.forum\/events\/[^/]+\/event\.json$/u.test(path) || /^rooms\/[^/]+\/events\/[^/]+\/event\.json$/u.test(path) || /^rooms\/[^/]+\/threads\/[^/]+\/events\/[^/]+\/event\.json$/u.test(path)) return "event";
  if (/^rooms\/[^/]+\/room\.json$/u.test(path)) return "room";
  if (/^rooms\/[^/]+\/members\/[^/]+\/membership\.json$/u.test(path)) return "room-member";
  if (/^rooms\/[^/]+\/threads\/[^/]+\/thread\.json$/u.test(path)) return "thread";
  if (/^rooms\/[^/]+\/threads\/[^/]+\/messages\/[^/]+\/message\.json$/u.test(path)) return "message";
  return undefined;
}

/**
 * 在 rebase 前直接检查 FETCH_HEAD 的协议文档，避免远端坏数据污染当前工作树、
 * 触发语义冲突 journal，或把正常的本地提交卷入无意义的 rebase。
 */
export function validateRemoteProtocolTree(input: {
  repository: string;
  remoteHead: string;
  forumId: string;
  branch: string;
}): SemanticIssue[] {
  const tree = runGit(input.repository, ["ls-tree", "-r", "--name-only", input.remoteHead]);
  if (tree.status !== 0) {
    return [{ code: "REMOTE_PROTOCOL_INSPECTION_FAILED", message: "could not inspect fetched remote protocol tree" }];
  }
  const paths = lines(tree.stdout);
  const pathSet = new Set(paths);
  const issues: SemanticIssue[] = [];
  for (const path of paths) {
    const schema = schemaForProtocolPath(path);
    if (!schema) continue;
    const shown = runGit(input.repository, ["show", `${input.remoteHead}:${path}`]);
    if (shown.status !== 0) {
      issues.push({ code: "REMOTE_PROTOCOL_INSPECTION_FAILED", path, message: "could not read protocol document from fetched remote" });
      continue;
    }
    let value: unknown;
    try { value = JSON.parse(shown.stdout); }
    catch {
      issues.push({ code: schema === "message" ? "REMOTE_MESSAGE_SCHEMA_INVALID" : "REMOTE_PROTOCOL_SCHEMA_INVALID", path, message: "remote protocol JSON is invalid" });
      continue;
    }
    const validation = validateProtocolDocument(schema, value, { mode: "read" });
    if (!validation.ok) {
      for (const issue of validation.issues) {
        issues.push({
          code: schema === "message" ? "REMOTE_MESSAGE_SCHEMA_INVALID" : "REMOTE_PROTOCOL_SCHEMA_INVALID",
          path,
          message: `${issue.path}: ${issue.message}`,
        });
      }
      continue;
    }
    const document = value as Record<string, unknown>;
    if (path === ".forum/protocol.json" && (document.forumId !== input.forumId || document.dataBranch !== input.branch)) {
      issues.push({ code: "REMOTE_PROTOCOL_MISMATCH", path, message: "remote protocol does not match the local forum registration" });
    }
    if (schema === "message") {
      const bodyPath = `${path.slice(0, -"message.json".length)}body.md`;
      if (!pathSet.has(bodyPath)) {
        issues.push({ code: "REMOTE_MESSAGE_BODY_MISSING", path: bodyPath, message: "remote message body is missing" });
      } else {
        const body = runGit(input.repository, ["show", `${input.remoteHead}:${bodyPath}`]);
        if (body.status !== 0 || body.stdout.trim().length === 0 || body.stdout.includes("\0")) {
          issues.push({ code: "REMOTE_MESSAGE_BODY_INVALID", path: bodyPath, message: "remote message body is empty, unreadable, or contains NUL" });
        }
      }
    }
  }
  return issues;
}

function isRootProtocolIssue(issue: SemanticIssue): boolean {
  return issue.path === ".forum/protocol.json" || issue.path === ".forum/forum.json";
}

function isQuarantinableLeafIssue(issue: SemanticIssue): boolean {
  if (!issue.path || isRootProtocolIssue(issue)) return false;
  return new Set([
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
  ]).has(issue.code);
}

export async function validateSynchronizedForum(input: {
  forumAlias: string;
  repository: string;
  originalRemoteHead: string | null;
  remoteHead: string;
  localHead: string;
  paths: AgentForumPaths;
}): Promise<SemanticValidationResult> {
  // 已在 remote 出现的不可变历史修改无法由客户端安全回滚；保留警告并继续，
  // 但绝不允许本机待 push 的提交修改不可变路径。
  const remoteImmutableIssues = modifiedImmutablePaths(input.repository, null, input.remoteHead).map((issue) => ({ ...issue, code: "REMOTE_IMMUTABLE_HISTORY_MODIFIED", message: `remote ${issue.message}` }));
  const immutableIssues = modifiedImmutablePaths(input.repository, input.remoteHead, input.localHead);
  const treeIssues = await validateCurrentTree(input.forumAlias, input.paths);
  const quarantinedIssues = [
    ...remoteImmutableIssues,
    ...treeIssues.filter(isQuarantinableLeafIssue),
  ];
  const semanticIssues = [
    ...treeIssues.filter((issue) => !isQuarantinableLeafIssue(issue)),
    ...concurrentEventIssues(
      input.repository,
      input.originalRemoteHead,
      input.remoteHead,
      input.localHead,
    ),
  ];
  return { immutableIssues, semanticIssues, quarantinedIssues };
}
