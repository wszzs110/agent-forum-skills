import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, posix, resolve, win32 } from "node:path";
import { runGit } from "./git.js";

export const CONTEXT_DRAFT_VERSION = "0-draft";

const protocolIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

export type SupportedPlatform = "win32" | "linux" | "darwin";

export interface GitWorkspaceContext {
  workspaceRoot: string;
  workspaceKey: string;
  branch: string | null;
  repositoryFingerprint?: string;
}

interface BindingBase {
  bindingId: string;
  workspaceKey: string;
  workspaceRoot: string;
  forumId: string;
  roomId: string;
  repositoryFingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchBinding extends BindingBase {
  scope: "branch";
  branch: string;
}

export interface WorkspaceBinding extends BindingBase {
  scope: "workspace";
}

export type ContextBinding = BranchBinding | WorkspaceBinding;

export interface BindingState {
  formatVersion: typeof CONTEXT_DRAFT_VERSION;
  bindings: ContextBinding[];
}

export type BindingInput =
  | {
      scope: "branch";
      branch: string;
      workspaceKey: string;
      workspaceRoot: string;
      forumId: string;
      roomId: string;
      repositoryFingerprint?: string;
    }
  | {
      scope: "workspace";
      workspaceKey: string;
      workspaceRoot: string;
      forumId: string;
      roomId: string;
      repositoryFingerprint?: string;
    };

export type Resolution =
  | { kind: "bound"; source: "branch" | "workspace"; binding: ContextBinding }
  | { kind: "unbound"; code: "CONTEXT_NOT_BOUND" };

export class ContextExperimentError extends Error {
  constructor(
    readonly code: "GIT_WORKSPACE_REQUIRED" | "BINDING_EXISTS" | "INVALID_BINDING",
    message: string,
  ) {
    super(message);
    this.name = "ContextExperimentError";
  }
}

function assertProtocolId(value: string, field: string): void {
  if (!protocolIdPattern.test(value)) {
    throw new ContextExperimentError(
      "INVALID_BINDING",
      `${field} is not a safe protocol identifier: ${value}`,
    );
  }
}

function pathApi(platform: SupportedPlatform): typeof posix | typeof win32 {
  return platform === "win32" ? win32 : posix;
}

export function agentForumRoot(
  homeDirectory: string,
  platform: SupportedPlatform,
): string {
  return pathApi(platform).join(homeDirectory, ".AgentForum");
}

export function normalizeWorkspaceKey(
  workspaceRoot: string,
  platform: SupportedPlatform,
): string {
  const api = pathApi(platform);
  let normalized = api.normalize(workspaceRoot);
  const parsed = api.parse(normalized);
  while (normalized.length > parsed.root.length && normalized.endsWith(api.sep)) {
    normalized = normalized.slice(0, -1);
  }

  if (platform === "win32") {
    normalized = normalized.replaceAll("\\", "/").toLowerCase();
  }
  return `${platform}:${normalized}`;
}

export function normalizeRepositoryFingerprint(remote: string): string | undefined {
  const trimmed = remote.trim();
  const scp = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/u.exec(trimmed);
  if (
    scp &&
    !trimmed.includes("://") &&
    !/^[a-zA-Z]:[\\/]/u.test(trimmed)
  ) {
    const host = scp[1]?.toLowerCase();
    const repositoryPath = scp[2]?.replace(/^\/+|\/+$/gu, "").replace(/\.git$/u, "");
    return host && repositoryPath ? `${host}/${repositoryPath}` : undefined;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname || !["http:", "https:", "ssh:", "git:"].includes(url.protocol)) {
      return undefined;
    }
    const repositoryPath = url.pathname
      .replace(/^\/+|\/+$/gu, "")
      .replace(/\.git$/u, "");
    return repositoryPath
      ? `${url.hostname.toLowerCase()}/${repositoryPath}`
      : undefined;
  } catch {
    // 本地路径不生成可共享 fingerprint，避免把绝对路径误发到论坛。
    return undefined;
  }
}

export async function discoverGitWorkspace(
  cwd: string,
  platform: SupportedPlatform = process.platform as SupportedPlatform,
): Promise<GitWorkspaceContext> {
  const rootResult = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0) {
    throw new ContextExperimentError(
      "GIT_WORKSPACE_REQUIRED",
      "the current directory is not inside a Git workspace",
    );
  }

  const workspaceRoot = await realpath(rootResult.stdout.trim());
  const branchResult = runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const remoteResult = runGit(cwd, ["config", "--get", "remote.origin.url"]);
  const repositoryFingerprint =
    remoteResult.status === 0
      ? normalizeRepositoryFingerprint(remoteResult.stdout)
      : undefined;

  return {
    workspaceRoot,
    workspaceKey: normalizeWorkspaceKey(workspaceRoot, platform),
    branch: branchResult.status === 0 ? branchResult.stdout.trim() : null,
    ...(repositoryFingerprint ? { repositoryFingerprint } : {}),
  };
}

export function emptyBindingState(): BindingState {
  return { formatVersion: CONTEXT_DRAFT_VERSION, bindings: [] };
}

function bindingIdentity(binding: BindingInput | ContextBinding): string {
  return binding.scope === "branch"
    ? `${binding.workspaceKey}\0branch\0${binding.branch}`
    : `${binding.workspaceKey}\0workspace`;
}

export function addBinding(
  state: BindingState,
  input: BindingInput,
  options: { force?: boolean; now?: string; bindingId?: string } = {},
): { state: BindingState; binding: ContextBinding } {
  assertProtocolId(input.forumId, "forumId");
  assertProtocolId(input.roomId, "roomId");
  if (input.scope === "branch" && input.branch.trim().length === 0) {
    throw new ContextExperimentError("INVALID_BINDING", "branch must not be empty");
  }

  const identity = bindingIdentity(input);
  const existing = state.bindings.find(
    (binding) => bindingIdentity(binding) === identity,
  );
  if (existing && !options.force) {
    throw new ContextExperimentError(
      "BINDING_EXISTS",
      `a ${input.scope} binding already exists for this workspace`,
    );
  }

  const now = options.now ?? new Date().toISOString();
  const common = {
    bindingId: options.bindingId ?? existing?.bindingId ?? `binding_${randomUUID()}`,
    workspaceKey: input.workspaceKey,
    workspaceRoot: input.workspaceRoot,
    forumId: input.forumId,
    roomId: input.roomId,
    ...(input.repositoryFingerprint
      ? { repositoryFingerprint: input.repositoryFingerprint }
      : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const binding: ContextBinding =
    input.scope === "branch"
      ? { ...common, scope: "branch", branch: input.branch }
      : { ...common, scope: "workspace" };
  const bindings = existing
    ? state.bindings.map((candidate) =>
        bindingIdentity(candidate) === identity ? binding : candidate,
      )
    : [...state.bindings, binding];

  return {
    state: { formatVersion: CONTEXT_DRAFT_VERSION, bindings },
    binding,
  };
}

export function removeBinding(
  state: BindingState,
  workspaceKey: string,
  scope: "branch" | "workspace",
  branch?: string,
): { state: BindingState; removed: number } {
  const identity =
    scope === "branch"
      ? `${workspaceKey}\0branch\0${branch ?? ""}`
      : `${workspaceKey}\0workspace`;
  const bindings = state.bindings.filter(
    (binding) => bindingIdentity(binding) !== identity,
  );
  return {
    state: { formatVersion: CONTEXT_DRAFT_VERSION, bindings },
    removed: state.bindings.length - bindings.length,
  };
}

export function resolveBinding(
  state: BindingState,
  context: GitWorkspaceContext,
): Resolution {
  if (context.branch !== null) {
    const exact = state.bindings.find(
      (binding) =>
        binding.scope === "branch" &&
        binding.workspaceKey === context.workspaceKey &&
        binding.branch === context.branch,
    );
    if (exact) return { kind: "bound", source: "branch", binding: exact };
  }

  const fallback = state.bindings.find(
    (binding) =>
      binding.scope === "workspace" &&
      binding.workspaceKey === context.workspaceKey,
  );
  return fallback
    ? { kind: "bound", source: "workspace", binding: fallback }
    : { kind: "unbound", code: "CONTEXT_NOT_BOUND" };
}

export async function saveBindingState(
  stateFile: string,
  state: BindingState,
): Promise<void> {
  await mkdir(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, stateFile);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function loadBindingState(stateFile: string): Promise<BindingState> {
  try {
    const value = JSON.parse(await readFile(stateFile, "utf8"));
    if (value.formatVersion !== CONTEXT_DRAFT_VERSION || !Array.isArray(value.bindings)) {
      throw new ContextExperimentError(
        "INVALID_BINDING",
        "unsupported or invalid context binding state",
      );
    }
    return value as BindingState;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyBindingState();
    }
    throw error;
  }
}
