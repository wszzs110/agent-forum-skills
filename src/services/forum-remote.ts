import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  findForum,
  loadLocalConfig,
  registerLocalForum,
  unregisterLocalForum,
  type LocalForumRegistration,
} from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import {
  assertCleanWorktree,
  assertGitBranchName,
  requireGit,
  runGit,
} from "../git/runner.js";
import {
  displayRemoteUrl,
  validateRemoteUrl,
} from "../git/remote.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  assertLocalAlias,
  createAgentForumPaths,
  forumClonePath,
  forumLockPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { ServiceError } from "./errors.js";
import { openForum, readJsonDocument } from "./room.js";

export interface ForumRemoteStatus {
  alias: string;
  forumId: string;
  path: string;
  expectedBranch: string;
  currentBranch: string | null;
  head: string | null;
  dirty: boolean | null;
  protocolValid: boolean;
  remote: {
    configured: boolean;
    displayUrl: string | null;
    upstream: string | null;
    ahead: number | null;
    behind: number | null;
  };
  health: "ready" | "local-only" | "dirty" | "unavailable" | "protocol-error";
  problems: string[];
}

export interface ForumOriginInspection {
  configured: boolean;
  matchesExpected: boolean;
  displayUrl: string | null;
}

/** 在本地初始化前探测 remote 是否已有任何数据分支，避免产生第二套 Forum 根。 */
export function remoteHasBranches(
  remote: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): boolean {
  const safeRemote = validateRemoteUrl(remote);
  const result = runGit(process.cwd(), ["ls-remote", "--heads", safeRemote.value]);
  if (result.status !== 0) {
    throw new ServiceError(
      "REMOTE_DISCOVERY_FAILED",
      "could not inspect whether the remote already contains Forum data",
    );
  }
  return result.stdout.trim().length > 0;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function remoteBranchFromHead(repository: string): string {
  const head = runGit(repository, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  const value = head.stdout.trim();
  if (head.status === 0 && value.startsWith("origin/") && value.length > "origin/".length) {
    return value.slice("origin/".length);
  }
  // 某些 bare remote 在首次 push 后仍将 HEAD 指向尚不存在的 master；
  // 单一实际分支没有歧义，可安全采用，多个分支仍要求调用者显式指定。
  const branches = runGit(repository, ["for-each-ref", "--format=%(refname:strip=3)", "refs/remotes/origin"]);
  const candidates = branches.status === 0
    ? branches.stdout.split(/\r?\n/u).map((item) => item.trim()).filter((item) => item && item !== "HEAD")
    : [];
  if (candidates.length === 1) return candidates[0]!;
  throw new ServiceError(
    "REMOTE_DEFAULT_BRANCH_NOT_FOUND",
    candidates.length > 1
      ? "remote has multiple branches but no usable default branch; provide --branch"
      : "remote default branch could not be discovered; provide --branch",
  );
}

async function validateClonedForum(
  repository: string,
  branch: string,
): Promise<{ forumId: string }> {
  try {
    const protocol = await readJsonDocument(
      resolve(repository, ".forum", "protocol.json"),
      "protocol",
    );
    const forum = await readJsonDocument(
      resolve(repository, ".forum", "forum.json"),
      "forum",
    );
    if (protocol.dataBranch !== branch || protocol.forumId !== forum.forumId) {
      throw new ServiceError(
        "REMOTE_PROTOCOL_INVALID",
        "remote forum metadata does not agree on forumId and dataBranch",
      );
    }
    return { forumId: String(protocol.forumId) };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "REMOTE_PROTOCOL_INVALID",
      "remote branch does not contain a valid Agent Forum protocol",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function addRemoteForum(
  input: {
    alias: string;
    remote: string;
    branch?: string;
    now?: Date;
  },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{
  alias: string;
  forumId: string;
  path: string;
  dataBranch: string;
  remote: string;
}> {
  assertLocalAlias(input.alias);
  const safeRemote = validateRemoteUrl(input.remote);
  const config = await loadLocalConfig(paths);
  if (config.forums.some((forum) => forum.alias === input.alias)) {
    throw new ServiceError(
      "FORUM_ALIAS_EXISTS",
      `forum alias is already configured: ${input.alias}`,
    );
  }
  const destination = forumClonePath(paths, input.alias);
  if (await pathExists(destination)) {
    throw new ServiceError(
      "FORUM_PATH_EXISTS",
      `managed forum path already exists: ${destination}`,
    );
  }
  await mkdir(paths.forumsDirectory, { recursive: true });

  let cloned = false;
  try {
    requireGit(paths.forumsDirectory, [
      "-c",
      "core.longpaths=true",
      "clone",
      "--no-checkout",
      "--origin",
      "origin",
      "--",
      safeRemote.value,
      destination,
    ]);
    cloned = true;
    requireGit(destination, [
      "-c",
      "core.longpaths=true",
      "config",
      "core.longpaths",
      "true",
    ]);
    requireGit(destination, ["config", "core.autocrlf", "false"]);
    const branch = input.branch ?? remoteBranchFromHead(destination);
    assertGitBranchName(destination, branch);
    const remoteBranch = runGit(destination, [
      "show-ref",
      "--verify",
      `refs/remotes/origin/${branch}`,
    ]);
    if (remoteBranch.status !== 0) {
      throw new ServiceError(
        "REMOTE_DEFAULT_BRANCH_NOT_FOUND",
        `remote branch does not exist: ${branch}`,
      );
    }
    requireGit(destination, [
      "checkout",
      "-B",
      branch,
      `origin/${branch}`,
    ]);
    requireGit(destination, [
      "branch",
      "--set-upstream-to",
      `origin/${branch}`,
      branch,
    ]);
    const validated = await validateClonedForum(destination, branch);
    const registration: LocalForumRegistration = {
      alias: input.alias,
      forumId: validated.forumId,
      path: destination,
      dataBranch: branch,
      createdAt: currentUtcTimestamp(input.now),
    };
    await registerLocalForum(registration, paths);
    return {
      alias: input.alias,
      forumId: validated.forumId,
      path: destination,
      dataBranch: branch,
      remote: safeRemote.display,
    };
  } catch (error) {
    if (cloned) await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

export async function inspectForumOriginRemote(
  input: { forumAlias: string; expectedRemote: string },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ForumOriginInspection> {
  const safeExpected = validateRemoteUrl(input.expectedRemote);
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const origin = runGit(registration.path, ["remote", "get-url", "origin"]);
  if (origin.status !== 0) {
    return { configured: false, matchesExpected: false, displayUrl: null };
  }
  const existing = origin.stdout.trim();
  return {
    configured: true,
    matchesExpected: existing === safeExpected.value,
    displayUrl: displayRemoteUrl(existing),
  };
}

export async function publishLocalForum(
  input: { forumAlias: string; remote: string },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ forumAlias: string; remote: string; branch: string; commit: string }> {
  const safeRemote = validateRemoteUrl(input.remote);
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum publish",
  });
  try {
    await openForum(input.forumAlias, paths, { requireClean: true });
    const existing = runGit(registration.path, ["remote", "get-url", "origin"]);
    if (
      existing.status === 0 &&
      existing.stdout.trim() !== safeRemote.value
    ) {
      throw new ServiceError(
        "REMOTE_ALREADY_CONFIGURED",
        `origin is already configured as ${displayRemoteUrl(existing.stdout.trim())}`,
      );
    }
    if (existing.status !== 0) {
      requireGit(registration.path, [
        "remote",
        "add",
        "origin",
        safeRemote.value,
      ]);
    }
    requireGit(registration.path, [
      "push",
      "--set-upstream",
      "origin",
      registration.dataBranch,
    ]);
    return {
      forumAlias: input.forumAlias,
      remote: safeRemote.display,
      branch: registration.dataBranch,
      commit: requireGit(registration.path, ["rev-parse", "HEAD"]).stdout.trim(),
    };
  } finally {
    await lock.release();
  }
}

function parseAheadBehind(value: string): { ahead: number; behind: number } | undefined {
  const parts = value.trim().split(/\s+/u).map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isSafeInteger(part))) {
    return undefined;
  }
  return { ahead: parts[0]!, behind: parts[1]! };
}

export async function getForumRemoteStatus(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ForumRemoteStatus> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const problems: string[] = [];
  if (!(await pathExists(registration.path))) {
    return {
      alias: registration.alias,
      forumId: registration.forumId,
      path: registration.path,
      expectedBranch: registration.dataBranch,
      currentBranch: null,
      head: null,
      dirty: null,
      protocolValid: false,
      remote: {
        configured: false,
        displayUrl: null,
        upstream: null,
        ahead: null,
        behind: null,
      },
      health: "unavailable",
      problems: ["managed clone path does not exist"],
    };
  }

  const branchResult = runGit(registration.path, ["branch", "--show-current"]);
  const currentBranch = branchResult.status === 0 ? branchResult.stdout.trim() || null : null;
  if (currentBranch !== registration.dataBranch) {
    problems.push(
      `current branch is ${currentBranch ?? "detached"}, expected ${registration.dataBranch}`,
    );
  }
  const headResult = runGit(registration.path, ["rev-parse", "HEAD"]);
  const head = headResult.status === 0 ? headResult.stdout.trim() : null;
  const statusResult = runGit(registration.path, ["status", "--porcelain"]);
  const dirty = statusResult.status === 0 ? statusResult.stdout.trim().length > 0 : null;
  if (dirty) problems.push("managed clone has uncommitted changes");

  let protocolValid = false;
  try {
    const protocol = await readJsonDocument(
      resolve(registration.path, ".forum", "protocol.json"),
      "protocol",
    );
    protocolValid =
      protocol.forumId === registration.forumId &&
      protocol.dataBranch === registration.dataBranch;
    if (!protocolValid) problems.push("protocol does not match local registration");
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  const remoteResult = runGit(registration.path, ["remote", "get-url", "origin"]);
  const remoteConfigured = remoteResult.status === 0;
  const displayUrl = remoteConfigured
    ? displayRemoteUrl(remoteResult.stdout.trim())
    : null;
  const upstreamResult = runGit(registration.path, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]);
  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout.trim() : null;
  let ahead: number | null = null;
  let behind: number | null = null;
  if (upstream) {
    const counts = runGit(registration.path, [
      "rev-list",
      "--left-right",
      "--count",
      `HEAD...${upstream}`,
    ]);
    if (counts.status === 0) {
      const parsed = parseAheadBehind(counts.stdout);
      if (parsed) {
        ahead = parsed.ahead;
        behind = parsed.behind;
      }
    }
  }
  if (!remoteConfigured) problems.push("origin is not configured");
  else if (!upstream) problems.push("current branch has no upstream");

  const health: ForumRemoteStatus["health"] = !protocolValid
    ? "protocol-error"
    : dirty
      ? "dirty"
      : !remoteConfigured || !upstream
        ? "local-only"
        : problems.length > 0
          ? "unavailable"
          : "ready";
  return {
    alias: registration.alias,
    forumId: registration.forumId,
    path: registration.path,
    expectedBranch: registration.dataBranch,
    currentBranch,
    head,
    dirty,
    protocolValid,
    remote: {
      configured: remoteConfigured,
      displayUrl,
      upstream,
      ahead,
      behind,
    },
    health,
    problems,
  };
}

export async function listRemoteForums(
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ forums: ForumRemoteStatus[] }> {
  const config = await loadLocalConfig(paths);
  const forums = await Promise.all(
    config.forums.map((forum) => getForumRemoteStatus(forum.alias, paths)),
  );
  forums.sort((left, right) => left.alias.localeCompare(right.alias));
  return { forums };
}

export async function removeLocalForum(
  input: { forumAlias: string; keepClone?: boolean },
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ forumAlias: string; clone: "kept" | "deleted"; path: string }> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, input.forumAlias);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum remove",
  });
  try {
    if (input.keepClone) {
      await unregisterLocalForum(input.forumAlias, paths);
      return { forumAlias: input.forumAlias, clone: "kept", path: registration.path };
    }
    const status = await getForumRemoteStatus(input.forumAlias, paths);
    if (status.dirty) assertCleanWorktree(registration.path);
    if (
      !status.remote.configured ||
      !status.remote.upstream ||
      status.remote.ahead === null ||
      status.remote.ahead > 0
    ) {
      throw new ServiceError(
        "LOCAL_COMMITS_NOT_PUSHED",
        "managed clone has no verified upstream or contains local-only commits; use --keep-clone",
      );
    }
    const temporary = `${registration.path}.removing-${randomUUID()}`;
    await rename(registration.path, temporary);
    try {
      await unregisterLocalForum(input.forumAlias, paths);
    } catch (error) {
      await rename(temporary, registration.path);
      throw error;
    }
    try {
      await rm(temporary, { recursive: true, force: true });
    } catch (error) {
      throw new ServiceError(
        "LOCAL_CLONE_CLEANUP_FAILED",
        "forum was unregistered but the renamed local clone could not be deleted",
        error instanceof Error ? error.message : String(error),
      );
    }
    return { forumAlias: input.forumAlias, clone: "deleted", path: registration.path };
  } finally {
    await lock.release();
  }
}
