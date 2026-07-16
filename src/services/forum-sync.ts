import { findForum, loadLocalConfig } from "../config/local-config.js";
import { requireGit, runGit, type GitCommandResult } from "../git/runner.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumLockPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { recordSyncConflict } from "./conflicts.js";
import { ServiceError } from "./errors.js";
import { openForum } from "./room.js";
import { validateSynchronizedForum } from "./semantic-validation.js";

export type SyncOutcome =
  | "up-to-date"
  | "updated"
  | "pushed"
  | "updated-and-pushed";

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
}

export interface ForumSyncOptions {
  maxRetries?: number;
  delay?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  beforePush?: (attempt: number) => Promise<void>;
}

function output(result: GitCommandResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
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

async function fetchAndRebase(
  forumAlias: string,
  forumId: string,
  repository: string,
  branch: string,
  originalHead: string,
  originalRemoteHead: string | null,
  paths: AgentForumPaths,
): Promise<string> {
  const fetch = runGit(repository, ["fetch", "origin", branch]);
  if (fetch.status !== 0) throw classifyTransportFailure("fetch", fetch);
  const remoteHead = requireGit(repository, [
    "rev-parse",
    `refs/remotes/origin/${branch}`,
  ]).stdout.trim();
  const localHead = requireGit(repository, ["rev-parse", "HEAD"]).stdout.trim();
  const rebase = runGit(repository, ["rebase", `origin/${branch}`]);
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
  return remoteHead;
}

function countAhead(repository: string, branch: string): number {
  const result = requireGit(repository, [
    "rev-list",
    "--count",
    `origin/${branch}..HEAD`,
  ]).stdout.trim();
  return Number(result);
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
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
  const lock = await acquireForumLock({
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
    let remoteHead = await fetchAndRebase(
      forumAlias,
      registration.forumId,
      registration.path,
      registration.dataBranch,
      originalHead,
      originalRemoteHead,
      paths,
    );
    fetches += 1;
    let integratedRemote = originalRemoteHead !== remoteHead;

    while (countAhead(registration.path, registration.dataBranch) > 0) {
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
      const nextRemote = await fetchAndRebase(
        forumAlias,
        registration.forumId,
        registration.path,
        registration.dataBranch,
        originalHead,
        originalRemoteHead,
        paths,
      );
      fetches += 1;
      if (nextRemote !== remoteHead) integratedRemote = true;
      remoteHead = nextRemote;
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
    };
  } finally {
    await lock.release();
  }
}
