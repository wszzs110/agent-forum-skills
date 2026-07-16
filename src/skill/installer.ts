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
  destinations: string[];
  version: string;
  files: number;
  requiresReload: true;
}

export interface StatusResult {
  target: SkillTarget;
  destination: string;
  destinations?: string[];
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
  destinations?: string[];
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

function namedSkillDestination(
  target: SkillTarget,
  skillName: "agent-forum" | "agent-forum-viewer",
  homeDirectory = homedir(),
): string {
  if (commonTargets.has(target)) {
    return resolve(homeDirectory, ".agents", "skills", skillName);
  }
  if (target === "claude-code") {
    return resolve(homeDirectory, ".claude", "skills", skillName);
  }
  throw new SkillInstallationError("INVALID_TARGET", `unsupported target: ${target}`);
}

export function skillDestination(target: SkillTarget, homeDirectory = homedir()): string {
  return namedSkillDestination(target, "agent-forum", homeDirectory);
}

export function viewerSkillDestination(target: SkillTarget, homeDirectory = homedir()): string {
  return namedSkillDestination(target, "agent-forum-viewer", homeDirectory);
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
  const coreSource = await resolveSkillSource(options.sourceDirectory);
  const viewerSource = resolve(dirname(coreSource), "agent-forum-viewer");
  if (!(await pathExists(resolve(viewerSource, "SKILL.md")))) {
    throw new SkillInstallationError("SKILL_SOURCE_NOT_FOUND", "could not locate skills/agent-forum-viewer/SKILL.md");
  }
  const payloads = [
    { source: coreSource, destination: skillDestination(options.target, homeDirectory) },
    { source: viewerSource, destination: viewerSkillDestination(options.target, homeDirectory) },
  ];
  const inspected = await Promise.all(payloads.map(async (payload) => {
    const files = await collectFiles(payload.source);
    const exists = await pathExists(payload.destination);
    const current = exists ? await collectFiles(payload.destination, payload.destination, true) : undefined;
    return { ...payload, files, exists, unchanged: current ? sameFiles(files, current) : false };
  }));
  const conflict = inspected.find((item) => item.exists && !item.unchanged);
  if (conflict && !options.force) {
    throw new SkillInstallationError("INSTALLATION_CONFLICT", `destination exists with different files: ${conflict.destination}`);
  }
  const destinations = inspected.map((item) => item.destination);
  const files = inspected.reduce((total, item) => total + Object.keys(item.files).length, 0);
  if (options.dryRun) {
    const changed = inspected.some((item) => !item.unchanged);
    const action = !changed ? "unchanged" : inspected.some((item) => item.exists && !item.unchanged) ? "would-replace" : "would-install";
    return { action, target: options.target, destination: destinations[0]!, destinations, version: VERSION, files, requiresReload: true };
  }
  for (const item of inspected) if (!item.unchanged) await replaceDirectory(item.source, item.destination);
  const state = await loadState(homeDirectory);
  const now = options.now ?? new Date().toISOString();
  let installations = [...state.installations];
  for (const item of inspected) {
    const existing = installations.find((record) => record.path === item.destination);
    const record: InstallationRecord = {
      path: item.destination,
      targets: [...new Set([...(existing?.targets ?? []), options.target])].sort(),
      version: VERSION,
      files: item.files,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
    };
    installations = existing ? installations.map((candidate) => candidate.path === item.destination ? record : candidate) : [...installations, record];
  }
  await saveState(homeDirectory, { formatVersion: 1, installations });
  return { action: inspected.every((item) => item.unchanged) ? "unchanged" : "installed", target: options.target, destination: destinations[0]!, destinations, version: VERSION, files, requiresReload: true };
}

export async function getSkillStatus(
  target: SkillTarget,
  homeDirectory = homedir(),
): Promise<StatusResult> {
  const destination = skillDestination(target, homeDirectory);
  const destinations = [destination, viewerSkillDestination(target, homeDirectory)];
  const state = await loadState(homeDirectory);
  const records = destinations.map((path) => state.installations.find(
    (installation) => installation.path === path && installation.targets.includes(target),
  ));
  const exists = await Promise.all(destinations.map((path) => pathExists(path)));
  if (exists.every((value) => !value)) return { target, destination, destinations, status: "not-installed" };
  if (records.some((record) => !record) || exists.some((value) => !value)) return { target, destination, destinations, status: "unmanaged" };
  let modified = false;
  let files = 0;
  for (let index = 0; index < destinations.length; index += 1) {
    const record = records[index]!;
    const current = await collectFiles(destinations[index]!, destinations[index]!, true);
    if (!sameFiles(current, record.files)) modified = true;
    files += Object.keys(record.files).length;
  }
  return { target, destination, destinations, status: modified ? "modified" : "installed", version: records[0]!.version, files };
}

export async function uninstallSkill(
  options: UninstallOptions,
): Promise<UninstallResult> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const destination = skillDestination(options.target, homeDirectory);
  const destinations = [destination, viewerSkillDestination(options.target, homeDirectory)];
  const state = await loadState(homeDirectory);
  const records = state.installations.filter((installation) => destinations.includes(installation.path) && installation.targets.includes(options.target));
  if (records.length === 0) return { action: "not-installed", target: options.target, destination, destinations, removedFiles: false };
  for (const record of records) {
    const remaining = record.targets.filter((target) => target !== options.target);
    if (remaining.length === 0 && await pathExists(record.path)) {
      const current = await collectFiles(record.path, record.path, true);
      if (!sameFiles(current, record.files) && !options.force) throw new SkillInstallationError("INSTALLATION_MODIFIED", `installed skill contains modified or additional files: ${record.path}`);
    }
  }
  const removesFiles = records.some((record) => record.targets.length === 1);
  if (options.dryRun) return { action: "would-uninstall", target: options.target, destination, destinations, removedFiles: removesFiles };
  let installations = [...state.installations];
  for (const record of records) {
    const remaining = record.targets.filter((target) => target !== options.target);
    if (remaining.length === 0) {
      await rm(record.path, { recursive: true, force: true });
      installations = installations.filter((candidate) => candidate.path !== record.path);
    } else {
      installations = installations.map((candidate) => candidate.path === record.path ? { ...candidate, targets: remaining } : candidate);
    }
  }
  await saveState(homeDirectory, { formatVersion: 1, installations });
  return { action: removesFiles ? "uninstalled" : "unregistered", target: options.target, destination, destinations, removedFiles: removesFiles };
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
