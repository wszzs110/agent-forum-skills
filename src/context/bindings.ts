import { readFile, realpath } from "node:fs/promises";
import { posix, win32 } from "node:path";
import { createEntityId } from "../domain/ids.js";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { runGit } from "../git/runner.js";
import { validateProtocolDocument } from "../protocol/validator.js";
import { writeValidatedJsonAtomic } from "../storage/atomic.js";
import { StorageError } from "../storage/errors.js";
import type { AgentForumPaths } from "../storage/paths.js";

export type SupportedPlatform = "win32" | "linux" | "darwin";

export interface GitWorkspaceContext {
  workspaceRoot: string;
  workspaceKey: string;
  branch: string | null;
  repositoryFingerprint?: string;
}

interface BindingBase {
  bindingId: string;
  workspaceType: "git";
  workspaceRoot: string;
  workspaceKey: string;
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

export interface ContextBindingState {
  formatVersion: 1;
  bindings: ContextBinding[];
}

export type BindingResolution =
  | {
      kind: "bound";
      source: "branch" | "workspace";
      binding: ContextBinding;
    }
  | { kind: "unbound"; code: "CONTEXT_NOT_BOUND" };

export class ContextError extends Error {
  constructor(
    readonly code:
      | "GIT_WORKSPACE_REQUIRED"
      | "GIT_BRANCH_REQUIRED"
      | "UNSUPPORTED_PLATFORM"
      | "BINDING_EXISTS"
      | "CONTEXT_NOT_BOUND"
      | "BINDING_TARGET_UNAVAILABLE",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ContextError";
  }
}

function pathApi(platform: SupportedPlatform): typeof posix | typeof win32 {
  return platform === "win32" ? win32 : posix;
}

export function supportedPlatform(value: NodeJS.Platform): SupportedPlatform {
  if (value === "win32" || value === "linux" || value === "darwin") {
    return value;
  }
  throw new ContextError(
    "UNSUPPORTED_PLATFORM",
    `context binding is not supported on platform: ${value}`,
  );
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

export function normalizeRepositoryFingerprint(
  remote: string,
): string | undefined {
  const trimmed = remote.trim();
  const scp = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/u.exec(trimmed);
  if (
    scp &&
    !trimmed.includes("://") &&
    !/^[a-zA-Z]:[\\/]/u.test(trimmed)
  ) {
    const host = scp[1]?.toLowerCase();
    const repositoryPath = scp[2]
      ?.replace(/^\/+|\/+$/gu, "")
      .replace(/\.git$/u, "");
    return host && repositoryPath ? `${host}/${repositoryPath}` : undefined;
  }

  try {
    const url = new URL(trimmed);
    if (
      !url.hostname ||
      !["http:", "https:", "ssh:", "git:"].includes(url.protocol)
    ) {
      return undefined;
    }
    const repositoryPath = url.pathname
      .replace(/^\/+|\/+$/gu, "")
      .replace(/\.git$/u, "");
    return repositoryPath
      ? `${url.hostname.toLowerCase()}/${repositoryPath}`
      : undefined;
  } catch {
    return undefined;
  }
}

export async function discoverGitWorkspace(
  cwd: string,
  platform: SupportedPlatform = supportedPlatform(process.platform),
): Promise<GitWorkspaceContext> {
  const rootResult = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0) {
    throw new ContextError(
      "GIT_WORKSPACE_REQUIRED",
      "the selected directory is not inside a Git workspace",
    );
  }
  const workspaceRoot = await realpath(rootResult.stdout.trim());
  const branchResult = runGit(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  const remoteResult = runGit(cwd, [
    "config",
    "--get",
    "remote.origin.url",
  ]);
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

export function emptyContextBindingState(): ContextBindingState {
  return { formatVersion: 1, bindings: [] };
}

function bindingIdentity(
  binding: Pick<ContextBinding, "scope" | "workspaceKey"> & {
    branch?: string;
  },
): string {
  return binding.scope === "branch"
    ? `${binding.workspaceKey}\0branch\0${binding.branch ?? ""}`
    : `${binding.workspaceKey}\0workspace`;
}

function platformFromWorkspaceKey(workspaceKey: string): SupportedPlatform {
  const prefix = workspaceKey.slice(0, workspaceKey.indexOf(":"));
  if (prefix === "win32" || prefix === "linux" || prefix === "darwin") {
    return prefix;
  }
  throw new StorageError(
    "SCHEMA_VALIDATION_FAILED",
    `binding has unsupported workspace key: ${workspaceKey}`,
  );
}

function validateBindingSemantics(state: ContextBindingState): void {
  const bindingIds = new Set<string>();
  const identities = new Set<string>();
  for (const binding of state.bindings) {
    if (bindingIds.has(binding.bindingId)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `context bindings contain duplicate binding ID: ${binding.bindingId}`,
      );
    }
    bindingIds.add(binding.bindingId);
    const identity = bindingIdentity(binding);
    if (identities.has(identity)) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        "context bindings contain duplicate workspace scope",
      );
    }
    identities.add(identity);
    const platform = platformFromWorkspaceKey(binding.workspaceKey);
    if (
      normalizeWorkspaceKey(binding.workspaceRoot, platform) !==
      binding.workspaceKey
    ) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding workspaceKey does not match workspaceRoot: ${binding.bindingId}`,
      );
    }
    if (
      binding.repositoryFingerprint &&
      (binding.repositoryFingerprint.includes("@") ||
        binding.repositoryFingerprint.includes("://") ||
        binding.repositoryFingerprint.includes("\\"))
    ) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding repository fingerprint is not credential-safe: ${binding.bindingId}`,
      );
    }
    if (binding.updatedAt < binding.createdAt) {
      throw new StorageError(
        "SCHEMA_VALIDATION_FAILED",
        `binding updatedAt precedes createdAt: ${binding.bindingId}`,
      );
    }
  }
}

export async function loadContextBindingState(
  paths: AgentForumPaths,
): Promise<ContextBindingState> {
  let text;
  try {
    text = await readFile(paths.bindingsFile, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyContextBindingState();
    }
    throw error;
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `context bindings contain invalid JSON: ${paths.bindingsFile}`,
      error instanceof Error ? error.message : String(error),
    );
  }
  const validation = validateProtocolDocument("context-bindings", value, {
    mode: "write",
  });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `context bindings are invalid: ${paths.bindingsFile}`,
      validation.issues,
    );
  }
  const state = value as ContextBindingState;
  validateBindingSemantics(state);
  return state;
}

export async function saveContextBindingState(
  paths: AgentForumPaths,
  state: ContextBindingState,
): Promise<void> {
  validateBindingSemantics(state);
  await writeValidatedJsonAtomic(
    paths.bindingsFile,
    "context-bindings",
    state,
    { overwrite: true, mode: 0o600 },
  );
}

function requireBindingBranch(branch: string | undefined): string {
  if (!branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "a branch binding requires a branch name",
    );
  }
  return branch;
}

export function setContextBinding(
  state: ContextBindingState,
  input: {
    context: GitWorkspaceContext;
    scope: "branch" | "workspace";
    branch?: string;
    forumId: string;
    roomId: string;
  },
  options: {
    force?: boolean;
    bindingId?: string;
    now?: Date;
  } = {},
): { state: ContextBindingState; binding: ContextBinding; replaced: boolean } {
  if (input.scope === "branch") requireBindingBranch(input.branch);
  const identity = bindingIdentity({
    scope: input.scope,
    workspaceKey: input.context.workspaceKey,
    ...(input.branch ? { branch: input.branch } : {}),
  });
  const existing = state.bindings.find(
    (binding) => bindingIdentity(binding) === identity,
  );
  if (existing && !options.force) {
    throw new ContextError(
      "BINDING_EXISTS",
      `a ${input.scope} binding already exists for this workspace and targets ${existing.forumId}/${existing.roomId}; use --force to replace it`,
      existing,
    );
  }
  const timestamp = currentUtcTimestamp(options.now);
  const common = {
    bindingId:
      options.bindingId ?? existing?.bindingId ?? createEntityId("binding"),
    workspaceType: "git" as const,
    workspaceRoot: input.context.workspaceRoot,
    workspaceKey: input.context.workspaceKey,
    forumId: input.forumId,
    roomId: input.roomId,
    ...(input.context.repositoryFingerprint
      ? { repositoryFingerprint: input.context.repositoryFingerprint }
      : {}),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const binding: ContextBinding =
    input.scope === "branch"
      ? {
          ...common,
          scope: "branch",
          branch: requireBindingBranch(input.branch),
        }
      : { ...common, scope: "workspace" };
  const bindings = existing
    ? state.bindings.map((candidate) =>
        bindingIdentity(candidate) === identity ? binding : candidate,
      )
    : [...state.bindings, binding];
  const next = { formatVersion: 1 as const, bindings };
  validateBindingSemantics(next);
  return { state: next, binding, replaced: Boolean(existing) };
}

export function removeContextBinding(
  state: ContextBindingState,
  workspaceKey: string,
  scope: "branch" | "workspace",
  branch?: string,
): { state: ContextBindingState; removed: ContextBinding[] } {
  const identity = bindingIdentity({
    scope,
    workspaceKey,
    ...(branch ? { branch } : {}),
  });
  const removed = state.bindings.filter(
    (binding) => bindingIdentity(binding) === identity,
  );
  return {
    state: {
      formatVersion: 1,
      bindings: state.bindings.filter(
        (binding) => bindingIdentity(binding) !== identity,
      ),
    },
    removed,
  };
}

export function resolveContextBinding(
  state: ContextBindingState,
  context: GitWorkspaceContext,
): BindingResolution {
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
