import { findForum, loadLocalConfig } from "../config/local-config.js";
import { isAbsolute, relative } from "node:path";
import { GitCommandError, requireGit, runGit, type GitCommandResult } from "../git/runner.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumLockPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { recordSyncConflict } from "./conflicts.js";
import { ServiceError } from "./errors.js";
import { openForum } from "./room.js";
import { validateRemoteProtocolTree, validateSynchronizedForum } from "./semantic-validation.js";

export type SyncOutcome =
  | "up-to-date"
  | "updated"
  | "pushed"
  | "updated-and-pushed";

export interface ForumSyncWarning {
  code: string;
  path?: string;
  message: string;
}

export interface ForumSyncResult {
  forumAlias: string;
  branch: string;
  outcome: SyncOutcome;
  originalHead: string;
  finalHead: string;
  remoteHead: string;
  fetches: number;
  pushAttempts: number;
  retries: number;
  warnings: ForumSyncWarning[];
}

export interface ForumSyncOptions {
  maxRetries?: number;
  delay?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  beforePush?: (attempt: number) => Promise<void>;
  // 仅供持有同一 Forum 锁的写事务内部使用，避免 refresh/commit/push 之间出现竞态窗口。
  lockAlreadyHeld?: boolean;
}

function output(result: GitCommandResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

/** 将 Git 子进程超时转换为同步层稳定错误码，保留其他异常的真实根因。 */
function normalizeSyncError(error: unknown): never {
  if (error instanceof GitCommandError && error.code === "GIT_COMMAND_TIMEOUT") {
    throw new ServiceError("SYNC_TIMEOUT", error.message, { cause: error.message });
  }
  throw error;
}

function isNonFastForward(result: GitCommandResult): boolean {
  const text = output(result).toLowerCase();
  return (
    text.includes("non-fast-forward") ||
    text.includes("fetch first") ||
    (text.includes("[rejected]") && text.includes("failed to push"))
  );
}

function classifyTransportFailure(
  operation: "fetch" | "push",
  result: GitCommandResult,
): ServiceError {
  const text = output(result);
  const lower = text.toLowerCase();
  if (
    lower.includes("authentication failed") ||
    lower.includes("permission denied") ||
    lower.includes("access denied") ||
    lower.includes("could not read username") ||
    lower.includes("publickey") ||
    lower.includes("repository not found")
  ) {
    return new ServiceError(
      "SYNC_AUTHENTICATION_FAILED",
      `${operation} failed because remote authentication or authorization was rejected`,
    );
  }
  if (
    lower.includes("could not resolve host") ||
    lower.includes("connection timed out") ||
    lower.includes("failed to connect") ||
    lower.includes("connection refused") ||
    lower.includes("network is unreachable") ||
    lower.includes("unable to access")
  ) {
    return new ServiceError(
      "SYNC_NETWORK_FAILED",
      `${operation} failed because the remote network was unavailable`,
    );
  }
  return new ServiceError(
    operation === "fetch" ? "SYNC_NETWORK_FAILED" : "SYNC_PUSH_FAILED",
    `${operation} failed: ${text || "Git returned a non-zero status"}`,
  );
}

function conflictPaths(repository: string): string[] {
  return runGit(repository, ["diff", "--name-only", "--diff-filter=U"])
    .stdout.split(/\r?\n/u)
    .filter(Boolean);
}

async function validateRebasedForum(
  forumAlias: string,
  repository: string,
  originalHead: string,
  paths: AgentForumPaths,
): Promise<void> {
  try {
    await openForum(forumAlias, paths, { requireClean: true });
  } catch (error) {
    runGit(repository, ["reset", "--hard", originalHead]);
    throw new ServiceError(
      "SYNC_PROTOCOL_FAILED",
      "rebased forum failed protocol validation; the original local HEAD was restored",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function fetchRemoteHead(repository: string, branch: string): string {
  // 显式 refspec 始终更新 FETCH_HEAD；部分受限宿主会静默阻止 refs/remotes/ 写入。
  const fetch = runGit(repository, ["fetch", "--no-tags", "origin", `refs/heads/${branch}`]);
  if (fetch.status !== 0) throw classifyTransportFailure("fetch", fetch);
  return requireGit(repository, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
}

async function fetchAndRebase(
  forumAlias: string,
  forumId: string,
  repository: string,
  branch: string,
  originalHead: string,
  originalRemoteHead: string | null,
  paths: AgentForumPaths,
  fetchedRemoteHead?: string,
): Promise<{ remoteHead: string; warnings: ForumSyncWarning[] }> {
  const remoteHead = fetchedRemoteHead ?? fetchRemoteHead(repository, branch);
  const remoteIssues = validateRemoteProtocolTree({ repository, remoteHead, forumId, branch });
  const blockingRemoteIssues = remoteIssues.filter((issue) =>
    issue.code === "REMOTE_PROTOCOL_INSPECTION_FAILED" ||
    issue.path === ".forum/protocol.json" ||
    issue.path === ".forum/forum.json",
  );
  if (blockingRemoteIssues.length > 0) {
    throw new ServiceError(
      "REMOTE_PROTOCOL_INVALID",
      "fetched remote has an invalid Forum root; no local commits were rebased",
      { remoteHead, issues: blockingRemoteIssues },
    );
  }
  const remoteWarnings: ForumSyncWarning[] = remoteIssues;
  const localHead = requireGit(repository, ["rev-parse", "HEAD"]).stdout.trim();
  const rebase = runGit(repository, ["rebase", remoteHead]);
  if (rebase.status !== 0) {
    const conflicts = conflictPaths(repository);
    runGit(repository, ["rebase", "--abort"]);
    if (conflicts.length > 0) {
      const journal = await recordSyncConflict({
        repository,
        forumId,
        forumAlias,
        branch,
        originalHead,
        localHead,
        remoteHead,
        conflicts,
        paths,
      });
      throw new ServiceError(
        "SYNC_REBASE_CONFLICT",
        "sync encountered Git content conflicts; the rebase was aborted and local commits were preserved",
        {
          operationId: journal.operationId,
          conflicts,
          originalHead,
          remoteHead,
          recoveryRef: journal.recoveryRef,
        },
      );
    }
    throw new ServiceError(
      "SYNC_REBASE_FAILED",
      `rebase failed and was aborted: ${output(rebase) || "Git returned a non-zero status"}`,
      { originalHead, remoteHead },
    );
  }
  await validateRebasedForum(
    forumAlias,
    repository,
    originalHead,
    paths,
  );
  const rebasedHead = requireGit(repository, ["rev-parse", "HEAD"]).stdout.trim();
  const validation = await validateSynchronizedForum({
    forumAlias,
    repository,
    originalRemoteHead,
    remoteHead,
    localHead: rebasedHead,
    paths,
  });
  const issues = validation.immutableIssues.length > 0
    ? validation.immutableIssues
    : validation.semanticIssues;
  if (issues.length > 0) {
    const journal = await recordSyncConflict({
      repository,
      forumId,
      forumAlias,
      branch,
      originalHead,
      localHead: rebasedHead,
      remoteHead,
      conflicts: issues.map((issue) => issue.path ?? issue.targetId ?? issue.code),
      paths,
    });
    runGit(repository, ["reset", "--hard", originalHead]);
    throw new ServiceError(
      validation.immutableIssues.length > 0
        ? "IMMUTABLE_HISTORY_MODIFIED"
        : "SEMANTIC_CONFLICT",
      validation.immutableIssues.length > 0
        ? "sync detected modified or deleted immutable protocol history"
        : "sync detected a protocol semantic conflict",
      { operationId: journal.operationId, recoveryRef: journal.recoveryRef, issues },
    );
  }
  return {
    remoteHead,
    warnings: [...remoteWarnings, ...validation.quarantinedIssues].map((warning) => sanitizeSyncWarning(repository, warning)),
  };
}

export interface ForumRefreshResult {
  forumAlias: string;
  outcome: "updated" | "up-to-date" | "skipped-local-commits" | "remote-not-configured";
  originalHead: string;
  finalHead: string;
  warnings: ForumSyncWarning[];
}

function countAhead(repository: string, base: string): number {
  const result = requireGit(repository, [
    "rev-list",
    "--count",
    `${base}..HEAD`,
  ]).stdout.trim();
  return Number(result);
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function sanitizeSyncWarning(repository: string, warning: ForumSyncWarning): ForumSyncWarning {
  if (!warning.path || !isAbsolute(warning.path)) return warning;
  const path = relative(repository, warning.path).replaceAll("\\", "/");
  return {
    ...warning,
    path: path && !path.startsWith("../") && path !== ".." ? path : "<outside-forum>",
  };
}

export async function refreshForumFromRemote(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ForumRefreshResult> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "viewer background refresh",
  });
  try {
    await openForum(forumAlias, paths, { requireClean: true });
    const originalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    if (runGit(registration.path, ["remote", "get-url", "origin"]).status !== 0) {
      return { forumAlias, outcome: "remote-not-configured", originalHead, finalHead: originalHead, warnings: [] };
    }
    const tracked = runGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`,
    ]);
    const originalRemoteHead = tracked.status === 0 ? tracked.stdout.trim() : null;
    const fetchedRemoteHead = fetchRemoteHead(registration.path, registration.dataBranch);
    if (countAhead(registration.path, fetchedRemoteHead) > 0) {
      return { forumAlias, outcome: "skipped-local-commits", originalHead, finalHead: originalHead, warnings: [] };
    }
    const refreshed = await fetchAndRebase(
      forumAlias,
      registration.forumId,
      registration.path,
      registration.dataBranch,
      originalHead,
      originalRemoteHead,
      paths,
      fetchedRemoteHead,
    );
    const finalHead = requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim();
    return {
      forumAlias,
      outcome: finalHead === originalHead ? "up-to-date" : "updated",
      originalHead,
      finalHead,
      warnings: refreshed.warnings,
    };
  } catch (error) {
    normalizeSyncError(error);
  } finally {
    await lock.release();
  }
}

export async function syncForum(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
  options: ForumSyncOptions = {},
): Promise<ForumSyncResult> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const maxRetries = options.maxRetries ?? 3;
  const delay = options.delay ?? defaultDelay;
  const random = options.random ?? Math.random;
  const lock = options.lockAlreadyHeld
    ? undefined
    : await acquireForumLock({
      lockPath: forumLockPath(paths, registration.forumId),
      command: "forum sync",
    });
  try {
    await openForum(forumAlias, paths, { requireClean: true });
    const remote = runGit(registration.path, ["remote", "get-url", "origin"]);
    if (remote.status !== 0) {
      throw new ServiceError(
        "REMOTE_NOT_CONFIGURED",
        "origin is not configured for this forum",
      );
    }
    const originalHead = requireGit(registration.path, ["rev-parse", "HEAD"])
      .stdout.trim();
    const originalRemote = runGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`,
    ]);
    const originalRemoteHead =
      originalRemote.status === 0 ? originalRemote.stdout.trim() : null;
    let fetches = 0;
    let pushAttempts = 0;
    let retries = 0;
    let successfulPush = false;
    const initialFetch = await fetchAndRebase(
      forumAlias,
      registration.forumId,
      registration.path,
      registration.dataBranch,
      originalHead,
      originalRemoteHead,
      paths,
    );
    let remoteHead = initialFetch.remoteHead;
    const warnings = [...initialFetch.warnings];
    fetches += 1;
    let integratedRemote = originalRemoteHead !== remoteHead;

    while (countAhead(registration.path, remoteHead) > 0) {
      pushAttempts += 1;
      await options.beforePush?.(pushAttempts);
      const push = runGit(registration.path, [
        "push",
        "origin",
        registration.dataBranch,
      ]);
      if (push.status === 0) {
        successfulPush = true;
        break;
      }
      if (!isNonFastForward(push)) {
        throw classifyTransportFailure("push", push);
      }
      if (retries >= maxRetries) {
        throw new ServiceError(
          "SYNC_RETRY_EXHAUSTED",
          `push did not converge after ${maxRetries} non-fast-forward retries`,
          { originalHead, remoteHead, pushAttempts },
        );
      }
      retries += 1;
      const milliseconds = Math.round(
        100 * 2 ** (retries - 1) * (0.5 + random()),
      );
      await delay(milliseconds);
      const nextFetch = await fetchAndRebase(
        forumAlias,
        registration.forumId,
        registration.path,
        registration.dataBranch,
        originalHead,
        originalRemoteHead,
        paths,
      );
      fetches += 1;
      warnings.push(...nextFetch.warnings);
      if (nextFetch.remoteHead !== remoteHead) integratedRemote = true;
      remoteHead = nextFetch.remoteHead;
    }

    const finalHead = requireGit(registration.path, ["rev-parse", "HEAD"])
      .stdout.trim();
    if (successfulPush) remoteHead = finalHead;
    const outcome: SyncOutcome = successfulPush
      ? integratedRemote
        ? "updated-and-pushed"
        : "pushed"
      : integratedRemote || finalHead !== originalHead
        ? "updated"
        : "up-to-date";
    return {
      forumAlias,
      branch: registration.dataBranch,
      outcome,
      originalHead,
      finalHead,
      remoteHead,
      fetches,
      pushAttempts,
      retries,
      warnings: [...new Map(warnings.map((warning) => [`${warning.code}\0${warning.path ?? ""}\0${warning.message}`, warning])).values()],
    };
  } catch (error) {
    return normalizeSyncError(error);
  } finally {
    await lock?.release();
  }
}
