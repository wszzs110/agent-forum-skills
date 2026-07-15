import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { VERSION } from "../version.js";

export type SkillTarget = "pi" | "opencode" | "codex" | "claude-code";
export type InstallationStatus =
  | "not-installed"
  | "unmanaged"
  | "installed"
  | "modified";

interface InstallationRecord {
  path: string;
  targets: SkillTarget[];
  version: string;
  files: Record<string, string>;
  installedAt: string;
  updatedAt: string;
}

interface InstallationState {
  formatVersion: 1;
  installations: InstallationRecord[];
}

export interface InstallOptions {
  target: SkillTarget;
  homeDirectory?: string;
  sourceDirectory?: string;
  dryRun?: boolean;
  force?: boolean;
  now?: string;
}

export interface InstallResult {
  action: "installed" | "unchanged" | "would-install" | "would-replace";
  target: SkillTarget;
  destination: string;
  version: string;
  files: number;
  requiresReload: true;
}

export interface StatusResult {
  target: SkillTarget;
  destination: string;
  status: InstallationStatus;
  version?: string;
  files?: number;
}

export interface UninstallOptions {
  target: SkillTarget;
  homeDirectory?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface UninstallResult {
  action: "uninstalled" | "unregistered" | "not-installed" | "would-uninstall";
  target: SkillTarget;
  destination: string;
  removedFiles: boolean;
}

export interface DoctorResult {
  ok: boolean;
  node: { ok: boolean; version: string; required: string };
  git: { ok: boolean; version?: string };
  installation: StatusResult;
}

export class SkillInstallationError extends Error {
  constructor(
    readonly code:
      | "INVALID_TARGET"
      | "SKILL_SOURCE_NOT_FOUND"
      | "INSTALLATION_CONFLICT"
      | "INSTALLATION_MODIFIED"
      | "INVALID_INSTALLATION_STATE",
    message: string,
  ) {
    super(message);
    this.name = "SkillInstallationError";
  }
}

const commonTargets = new Set<SkillTarget>(["pi", "opencode", "codex"]);

function emptyState(): InstallationState {
  return { formatVersion: 1, installations: [] };
}

function stateFile(homeDirectory: string): string {
  return resolve(homeDirectory, ".AgentForum", "state", "installations.json");
}

export function skillDestination(
  target: SkillTarget,
  homeDirectory = homedir(),
): string {
  if (commonTargets.has(target)) {
    return resolve(homeDirectory, ".agents", "skills", "agent-forum");
  }
  if (target === "claude-code") {
    return resolve(homeDirectory, ".claude", "skills", "agent-forum");
  }
  throw new SkillInstallationError("INVALID_TARGET", `unsupported target: ${target}`);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function loadState(homeDirectory: string): Promise<InstallationState> {
  try {
    const parsed = JSON.parse(await readFile(stateFile(homeDirectory), "utf8"));
    if (
      parsed.formatVersion !== 1 ||
      !Array.isArray(parsed.installations)
    ) {
      throw new SkillInstallationError(
        "INVALID_INSTALLATION_STATE",
        "unsupported or invalid installation state",
      );
    }
    return parsed as InstallationState;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyState();
    }
    throw error;
  }
}

async function saveState(
  homeDirectory: string,
  state: InstallationState,
): Promise<void> {
  const destination = stateFile(homeDirectory);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function collectFiles(
  root: string,
  current = root,
  allowSymbolicLinks = false,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isSymbolicLink()) {
      if (!allowSymbolicLinks) {
        throw new SkillInstallationError(
          "INSTALLATION_CONFLICT",
          `symbolic links are not allowed in the managed skill payload: ${absolute}`,
        );
      }
      const relativePath = relative(root, absolute).split(sep).join("/");
      files[relativePath] = "SYMLINK";
      continue;
    }
    if (entry.isDirectory()) {
      Object.assign(
        files,
        await collectFiles(root, absolute, allowSymbolicLinks),
      );
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = relative(root, absolute).split(sep).join("/");
    files[relativePath] = createHash("sha256")
      .update(await readFile(absolute))
      .digest("hex");
  }
  return files;
}

function sameFiles(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftEntries = Object.entries(left).sort();
  const rightEntries = Object.entries(right).sort();
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

export async function resolveSkillSource(
  explicit?: string,
): Promise<string> {
  const candidates = [
    explicit,
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    resolve(process.cwd(), "skills", "agent-forum"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await pathExists(resolve(candidate, "SKILL.md"))) return candidate;
  }
  throw new SkillInstallationError(
    "SKILL_SOURCE_NOT_FOUND",
    "could not locate skills/agent-forum/SKILL.md",
  );
}

async function replaceDirectory(
  source: string,
  destination: string,
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const staging = `${destination}.staging-${randomUUID()}`;
  const backup = `${destination}.backup-${randomUUID()}`;
  let movedExisting = false;

  try {
    await cp(source, staging, { recursive: true, errorOnExist: true });
    if (await pathExists(destination)) {
      await rename(destination, backup);
      movedExisting = true;
    }
    await rename(staging, destination);
    if (movedExisting) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (movedExisting && !(await pathExists(destination))) {
      await rename(backup, destination);
    }
    throw error;
  }
}

export async function installSkill(
  options: InstallOptions,
): Promise<InstallResult> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const source = await resolveSkillSource(options.sourceDirectory);
  const destination = skillDestination(options.target, homeDirectory);
  const sourceFiles = await collectFiles(source);
  const destinationExists = await pathExists(destination);
  const destinationFiles = destinationExists
    ? await collectFiles(destination, destination, true)
    : undefined;
  const unchanged = destinationFiles
    ? sameFiles(sourceFiles, destinationFiles)
    : false;

  if (destinationExists && !unchanged && !options.force) {
    throw new SkillInstallationError(
      "INSTALLATION_CONFLICT",
      `destination exists with different files: ${destination}`,
    );
  }

  if (options.dryRun) {
    return {
      action: destinationExists ? (unchanged ? "unchanged" : "would-replace") : "would-install",
      target: options.target,
      destination,
      version: VERSION,
      files: Object.keys(sourceFiles).length,
      requiresReload: true,
    };
  }

  if (!unchanged) await replaceDirectory(source, destination);

  const state = await loadState(homeDirectory);
  const existing = state.installations.find(
    (installation) => installation.path === destination,
  );
  const now = options.now ?? new Date().toISOString();
  const targets = [...new Set([...(existing?.targets ?? []), options.target])].sort();
  const record: InstallationRecord = {
    path: destination,
    targets,
    version: VERSION,
    files: sourceFiles,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
  };
  const installations = existing
    ? state.installations.map((installation) =>
        installation.path === destination ? record : installation,
      )
    : [...state.installations, record];
  await saveState(homeDirectory, { formatVersion: 1, installations });

  return {
    action: unchanged ? "unchanged" : "installed",
    target: options.target,
    destination,
    version: VERSION,
    files: Object.keys(sourceFiles).length,
    requiresReload: true,
  };
}

export async function getSkillStatus(
  target: SkillTarget,
  homeDirectory = homedir(),
): Promise<StatusResult> {
  const destination = skillDestination(target, homeDirectory);
  const state = await loadState(homeDirectory);
  const record = state.installations.find(
    (installation) =>
      installation.path === destination && installation.targets.includes(target),
  );
  if (!(await pathExists(destination))) {
    return { target, destination, status: "not-installed" };
  }
  if (!record) return { target, destination, status: "unmanaged" };

  const files = await collectFiles(destination, destination, true);
  return {
    target,
    destination,
    status: sameFiles(files, record.files) ? "installed" : "modified",
    version: record.version,
    files: Object.keys(record.files).length,
  };
}

export async function uninstallSkill(
  options: UninstallOptions,
): Promise<UninstallResult> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const destination = skillDestination(options.target, homeDirectory);
  const state = await loadState(homeDirectory);
  const record = state.installations.find(
    (installation) =>
      installation.path === destination && installation.targets.includes(options.target),
  );
  if (!record) {
    return {
      action: "not-installed",
      target: options.target,
      destination,
      removedFiles: false,
    };
  }

  const remainingTargets = record.targets.filter(
    (target) => target !== options.target,
  );
  const shouldRemoveFiles = remainingTargets.length === 0;
  if (shouldRemoveFiles && (await pathExists(destination))) {
    const currentFiles = await collectFiles(destination, destination, true);
    if (!sameFiles(currentFiles, record.files) && !options.force) {
      throw new SkillInstallationError(
        "INSTALLATION_MODIFIED",
        `installed skill contains modified or additional files: ${destination}`,
      );
    }
  }

  if (options.dryRun) {
    return {
      action: "would-uninstall",
      target: options.target,
      destination,
      removedFiles: shouldRemoveFiles,
    };
  }

  if (shouldRemoveFiles) {
    await rm(destination, { recursive: true, force: true });
  }
  const installations = shouldRemoveFiles
    ? state.installations.filter((installation) => installation.path !== destination)
    : state.installations.map((installation) =>
        installation.path === destination
          ? { ...installation, targets: remainingTargets }
          : installation,
      );
  await saveState(homeDirectory, { formatVersion: 1, installations });

  return {
    action: shouldRemoveFiles ? "uninstalled" : "unregistered",
    target: options.target,
    destination,
    removedFiles: shouldRemoveFiles,
  };
}

export async function doctorSkill(
  target: SkillTarget,
  homeDirectory = homedir(),
): Promise<DoctorResult> {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const git = spawnSync("git", ["--version"], {
    encoding: "utf8",
    shell: false,
  });
  const installation = await getSkillStatus(target, homeDirectory);
  const node = { ok: major >= 20, version: process.versions.node, required: ">=20" };
  const gitResult =
    git.status === 0
      ? { ok: true, version: (git.stdout ?? "").trim() }
      : { ok: false };
  return {
    ok: node.ok && gitResult.ok && installation.status === "installed",
    node,
    git: gitResult,
    installation,
  };
}
