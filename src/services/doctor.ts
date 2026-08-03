import { access, lstat, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { loadLocalConfig } from "../config/local-config.js";
import { loadContextBindingState } from "../context/bindings.js";
import { runGit } from "../git/runner.js";
import { clearStaleForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  forumLockPath,
  type AgentForumPaths,
} from "../storage/paths.js";
import { listConflicts } from "./conflicts.js";
import { getForumRemoteStatus } from "./forum-remote.js";
import { getForumSnapshot } from "./timeline-cache.js";

export interface DoctorCheck {
  id: string;
  status: "ok" | "warning" | "error";
  message: string;
  details?: unknown;
}

export interface DoctorResult {
  healthy: boolean;
  checks: DoctorCheck[];
  repaired: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function diagnoseAgentForum(
  input: {
    forumAlias?: string;
    network?: boolean;
    repairStaleLocks?: boolean;
  } = {},
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  const repaired: string[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    id: "node.version",
    status: nodeMajor >= 20 ? "ok" : "error",
    message: `Node.js ${process.versions.node}`,
  });
  const git = runGit(process.cwd(), ["--version"]);
  checks.push({
    id: "git.version",
    status: git.status === 0 ? "ok" : "error",
    message: git.status === 0 ? git.stdout.trim() : "Git is unavailable",
  });

  let config;
  try {
    config = await loadLocalConfig(paths);
    checks.push({ id: "config", status: "ok", message: `${config.forums.length} forum(s) configured` });
  } catch (error) {
    checks.push({ id: "config", status: "error", message: error instanceof Error ? error.message : String(error) });
    return { healthy: false, checks, repaired };
  }
  try {
    const bindings = await loadContextBindingState(paths);
    checks.push({ id: "context.bindings", status: "ok", message: `${bindings.bindings.length} binding(s)` });
  } catch (error) {
    checks.push({ id: "context.bindings", status: "error", message: error instanceof Error ? error.message : String(error) });
  }

  if (await exists(paths.root)) {
    try {
      await access(paths.root, constants.R_OK | constants.W_OK);
      checks.push({ id: "storage.permissions", status: "ok", message: "Agent Forum root is readable and writable" });
    } catch {
      checks.push({ id: "storage.permissions", status: "error", message: "Agent Forum root is not readable and writable" });
    }
  } else {
    checks.push({ id: "storage.permissions", status: "warning", message: "Agent Forum root does not exist yet" });
  }

  const registrations = input.forumAlias
    ? config.forums.filter((forum) => forum.alias === input.forumAlias)
    : config.forums;
  if (input.forumAlias && registrations.length === 0) {
    checks.push({ id: "forum.selection", status: "error", message: `forum is not configured: ${input.forumAlias}` });
  }

  for (const forum of registrations) {
    const prefix = `forum.${forum.alias}`;
    try {
      const status = await getForumRemoteStatus(forum.alias, paths);
      checks.push({
        id: `${prefix}.status`,
        status: status.health === "ready" ? "ok" : status.health === "local-only" ? "warning" : "error",
        message: `forum health: ${status.health}`,
        details: status,
      });
      const gitPath = runGit(forum.path, ["rev-parse", "--git-path", "rebase-merge"]);
      const applyPath = runGit(forum.path, ["rev-parse", "--git-path", "rebase-apply"]);
      const rebasePresent =
        (gitPath.status === 0 && await exists(resolve(forum.path, gitPath.stdout.trim()))) ||
        (applyPath.status === 0 && await exists(resolve(forum.path, applyPath.stdout.trim())));
      checks.push({
        id: `${prefix}.rebase`,
        status: rebasePresent ? "error" : "ok",
        message: rebasePresent ? "an interrupted rebase is present" : "no interrupted rebase",
      });
      try {
        const journals = await listConflicts(forum.alias, paths);
        let missingRefs = 0;
        for (const journal of journals.conflicts) {
          if (runGit(forum.path, ["rev-parse", "--verify", journal.recoveryRef]).status !== 0) missingRefs += 1;
        }
        checks.push({
          id: `${prefix}.conflicts`,
          status: missingRefs > 0 ? "error" : journals.conflicts.length > 0 ? "warning" : "ok",
          message: `${journals.conflicts.length} conflict journal(s), ${missingRefs} missing recovery ref(s)`,
        });
      } catch (error) {
        checks.push({ id: `${prefix}.conflicts`, status: "error", message: error instanceof Error ? error.message : String(error) });
      }
      if (input.network && status.remote.configured) {
        const remote = runGit(forum.path, ["ls-remote", "--exit-code", "origin", forum.dataBranch]);
        checks.push({
          id: `${prefix}.network`,
          status: remote.status === 0 ? "ok" : "error",
          message: remote.status === 0 ? "remote branch is reachable" : "remote branch is not reachable",
        });
      }
    } catch (error) {
      checks.push({ id: `${prefix}.status`, status: "error", message: error instanceof Error ? error.message : String(error) });
    }

    const lockPath = forumLockPath(paths, forum.forumId);
    if (await exists(lockPath)) {
      if (input.repairStaleLocks) {
        try {
          if (await clearStaleForumLock({ lockPath })) {
            repaired.push(lockPath);
            checks.push({ id: `${prefix}.lock`, status: "ok", message: "stale lock was removed" });
          }
        } catch (error) {
          checks.push({ id: `${prefix}.lock`, status: "warning", message: error instanceof Error ? error.message : String(error) });
        }
      } else {
        checks.push({ id: `${prefix}.lock`, status: "warning", message: "forum lock exists; use --repair-stale-locks only after review" });
      }
    } else {
      checks.push({ id: `${prefix}.lock`, status: "ok", message: "no forum lock" });
    }

    // 数据健康：扫描损坏记录（schema 非法消息等）。损坏叶子记录被隔离展示，不影响无关操作。
    try {
      const cached = await getForumSnapshot(forum.alias, paths);
      const damageWarnings = cached.snapshot.warnings.filter(
        (warning) =>
          warning.code === "INVALID_MESSAGE_PATH" ||
          warning.code === "INVALID_MESSAGE_BODY" ||
          warning.code === "PROTOCOL_DATA_DAMAGED",
      );
      const uniquePaths = [...new Set(damageWarnings.map((warning) => warning.path))];
      checks.push({
        id: `${prefix}.data`,
        status: uniquePaths.length > 0 ? "warning" : "ok",
        message: uniquePaths.length > 0
          ? `${uniquePaths.length} damaged record(s) detected; they are isolated and do not block unrelated work`
          : "no damaged records",
        ...(uniquePaths.length > 0 ? { details: uniquePaths.slice(0, 10) } : {}),
      });
    } catch (error) {
      checks.push({ id: `${prefix}.data`, status: "warning", message: error instanceof Error ? error.message : String(error) });
    }
  }

  // 发现不再对应已注册 Forum 的锁，但不自动删除。
  if (await exists(paths.locksDirectory)) {
    const known = new Set(config.forums.map((forum) => `${forum.forumId}.lock`));
    const entries = await readdir(paths.locksDirectory, { withFileTypes: true });
    const orphaned = entries.filter((entry) => entry.isDirectory() && entry.name.endsWith(".lock") && !known.has(entry.name));
    if (orphaned.length > 0) {
      checks.push({ id: "locks.orphaned", status: "warning", message: `${orphaned.length} orphaned lock(s) require review` });
    }
  }
  return {
    healthy: !checks.some((check) => check.status === "error"),
    checks,
    repaired,
  };
}
