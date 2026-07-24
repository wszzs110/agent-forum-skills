import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { isEntityId } from "../domain/ids.js";
import { StorageError } from "./errors.js";

const localAliasPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

export interface AgentForumPaths {
  root: string;
  configFile: string;
  forumsDirectory: string;
  stateDirectory: string;
  locksDirectory: string;
  cacheDirectory: string;
  viewerDirectory: string;
  dashboardDirectory: string;
  dashboardRuntimeFile: string;
  dashboardDesktopFile: string;
  dashboardInstallDirectory: string;
  dashboardInstallationFile: string;
  installationsFile: string;
  bindingsFile: string;
}

export function createAgentForumPaths(
  homeDirectory = homedir(),
): AgentForumPaths {
  const root = resolve(homeDirectory, ".AgentForum");
  const stateDirectory = resolve(root, "state");
  return {
    root,
    configFile: resolve(root, "config.json"),
    forumsDirectory: resolve(root, "forums"),
    stateDirectory,
    locksDirectory: resolve(stateDirectory, "locks"),
    cacheDirectory: resolve(stateDirectory, "cache"),
    viewerDirectory: resolve(stateDirectory, "viewer"),
    dashboardDirectory: resolve(stateDirectory, "dashboard"),
    dashboardRuntimeFile: resolve(stateDirectory, "dashboard", "runtime.json"),
    dashboardDesktopFile: resolve(stateDirectory, "dashboard", "desktop.json"),
    dashboardInstallDirectory: resolve(root, "dashboard"),
    dashboardInstallationFile: resolve(root, "dashboard", "installation.json"),
    installationsFile: resolve(stateDirectory, "installations.json"),
    bindingsFile: resolve(stateDirectory, "context-bindings.json"),
  };
}

export function assertLocalAlias(alias: string): void {
  if (!localAliasPattern.test(alias)) {
    throw new StorageError(
      "INVALID_LOCAL_ALIAS",
      `local alias must match ${localAliasPattern.source}: ${alias}`,
    );
  }
}

export function forumClonePath(paths: AgentForumPaths, alias: string): string {
  assertLocalAlias(alias);
  return resolve(paths.forumsDirectory, alias);
}

export function forumStatePath(
  paths: AgentForumPaths,
  forumId: string,
): string {
  if (!isEntityId(forumId, "forum")) {
    throw new StorageError("INVALID_FORUM_ID", `invalid forum ID: ${forumId}`);
  }
  return resolve(paths.stateDirectory, forumId);
}

export function forumLockPath(
  paths: AgentForumPaths,
  forumId: string,
): string {
  if (!isEntityId(forumId, "forum")) {
    throw new StorageError("INVALID_FORUM_ID", `invalid forum ID: ${forumId}`);
  }
  return resolve(paths.locksDirectory, `${forumId}.lock`);
}

export async function sameExistingPath(left: string, right: string): Promise<boolean> {
  const [canonicalLeft, canonicalRight] = await Promise.all([
    realpath(resolve(left)),
    realpath(resolve(right)),
  ]);
  if (process.platform === "win32") {
    return canonicalLeft.toLowerCase() === canonicalRight.toLowerCase();
  }
  return canonicalLeft === canonicalRight;
}

export function resolveInside(root: string, ...segments: string[]): string {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, ...segments);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new StorageError(
      "PATH_OUTSIDE_ROOT",
      `resolved path is outside the managed root: ${target}`,
    );
  }
  return target;
}
