import { randomUUID } from "node:crypto";
import { readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { findForum, loadLocalConfig } from "../config/local-config.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { assertCleanWorktree, requireGit, runGit } from "../git/runner.js";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, forumLockPath, forumStatePath, type AgentForumPaths } from "../storage/paths.js";
import { ServiceError } from "./errors.js";

export interface ConflictJournal {
  formatVersion: 1;
  operationId: string;
  forumId: string;
  forumAlias: string;
  branch: string;
  status: "conflict" | "reissue-prepared";
  originalHead: string;
  localHead: string;
  remoteHead: string;
  recoveryRef: string;
  conflicts: string[];
  createdAt: string;
  updatedAt: string;
}

function operationsDirectory(paths: AgentForumPaths, forumId: string): string {
  return resolve(forumStatePath(paths, forumId), "operations");
}

function journalPath(paths: AgentForumPaths, forumId: string, operationId: string): string {
  if (!/^op_[0-9a-f-]{36}$/u.test(operationId)) {
    throw new ServiceError("CONFLICT_NOT_FOUND", `invalid conflict ID: ${operationId}`);
  }
  return resolve(operationsDirectory(paths, forumId), `${operationId}.json`);
}

function validateJournal(value: unknown): ConflictJournal {
  if (!value || typeof value !== "object") throw new Error("journal is not an object");
  const item = value as Partial<ConflictJournal>;
  if (
    item.formatVersion !== 1 ||
    typeof item.operationId !== "string" ||
    typeof item.forumId !== "string" ||
    typeof item.forumAlias !== "string" ||
    typeof item.branch !== "string" ||
    !["conflict", "reissue-prepared"].includes(String(item.status)) ||
    typeof item.originalHead !== "string" ||
    typeof item.localHead !== "string" ||
    typeof item.remoteHead !== "string" ||
    typeof item.recoveryRef !== "string" ||
    !Array.isArray(item.conflicts) ||
    !item.conflicts.every((path) => typeof path === "string") ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    throw new Error("journal fields are invalid");
  }
  return item as ConflictJournal;
}

export async function recordSyncConflict(input: {
  repository: string;
  forumId: string;
  forumAlias: string;
  branch: string;
  originalHead: string;
  localHead: string;
  remoteHead: string;
  conflicts: string[];
  paths: AgentForumPaths;
}): Promise<ConflictJournal> {
  const operationId = `op_${randomUUID()}`;
  const recoveryRef = `refs/agent-forum/recovery/${operationId.slice(3)}`;
  requireGit(input.repository, ["update-ref", recoveryRef, input.originalHead]);
  const timestamp = currentUtcTimestamp();
  const journal: ConflictJournal = {
    formatVersion: 1,
    operationId,
    forumId: input.forumId,
    forumAlias: input.forumAlias,
    branch: input.branch,
    status: "conflict",
    originalHead: input.originalHead,
    localHead: input.localHead,
    remoteHead: input.remoteHead,
    recoveryRef,
    conflicts: input.conflicts,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    await writeJsonAtomic(journalPath(input.paths, input.forumId, operationId), journal);
  } catch (error) {
    runGit(input.repository, ["update-ref", "-d", recoveryRef]);
    throw error;
  }
  return journal;
}

async function registrationFor(alias: string, paths: AgentForumPaths) {
  return findForum(await loadLocalConfig(paths), alias);
}

export async function getConflict(
  forumAlias: string,
  operationId: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ConflictJournal> {
  const registration = await registrationFor(forumAlias, paths);
  try {
    return validateJournal(
      JSON.parse(await readFile(journalPath(paths, registration.forumId, operationId), "utf8")),
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new ServiceError("CONFLICT_NOT_FOUND", `conflict was not found: ${operationId}`);
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("CONFLICT_JOURNAL_DAMAGED", `conflict journal is damaged: ${operationId}`);
  }
}

export async function listConflicts(
  forumAlias: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ conflicts: ConflictJournal[] }> {
  const registration = await registrationFor(forumAlias, paths);
  let entries;
  try {
    entries = await readdir(operationsDirectory(paths, registration.forumId));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { conflicts: [] };
    }
    throw error;
  }
  const conflicts: ConflictJournal[] = [];
  for (const entry of entries.filter((name) => name.endsWith(".json"))) {
    conflicts.push(await getConflict(forumAlias, entry.slice(0, -5), paths));
  }
  conflicts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return { conflicts };
}

export async function prepareConflictReissue(
  forumAlias: string,
  operationId: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ConflictJournal> {
  const registration = await registrationFor(forumAlias, paths);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum conflict prepare-reissue",
  });
  try {
    const journal = await getConflict(forumAlias, operationId, paths);
    assertCleanWorktree(registration.path);
    requireGit(registration.path, ["rev-parse", journal.recoveryRef]);
    const remoteHead = requireGit(registration.path, [
      "rev-parse",
      `refs/remotes/origin/${registration.dataBranch}`,
    ]).stdout.trim();
    if (remoteHead !== journal.remoteHead) {
      throw new ServiceError(
        "CONFLICT_REMOTE_CHANGED",
        "remote-tracking HEAD changed after the conflict; retry sync before preparing a reissue",
      );
    }
    requireGit(registration.path, ["reset", "--hard", journal.remoteHead]);
    const updated: ConflictJournal = {
      ...journal,
      status: "reissue-prepared",
      updatedAt: currentUtcTimestamp(),
    };
    await writeJsonAtomic(journalPath(paths, registration.forumId, operationId), updated, {
      overwrite: true,
    });
    return updated;
  } finally {
    await lock.release();
  }
}

export async function closeConflict(
  forumAlias: string,
  operationId: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ operationId: string; closed: true }> {
  const registration = await registrationFor(forumAlias, paths);
  const lock = await acquireForumLock({
    lockPath: forumLockPath(paths, registration.forumId),
    command: "forum conflict close",
  });
  try {
    const journal = await getConflict(forumAlias, operationId, paths);
    requireGit(registration.path, ["update-ref", "-d", journal.recoveryRef]);
    await rm(journalPath(paths, registration.forumId, operationId), { force: true });
    return { operationId, closed: true };
  } finally {
    await lock.release();
  }
}
