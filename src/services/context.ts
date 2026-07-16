import { resolve } from "node:path";
import {
  findForum,
  loadLocalConfig,
  type LocalConfig,
  type LocalForumRegistration,
} from "../config/local-config.js";
import {
  ContextError,
  discoverGitWorkspace,
  loadContextBindingState,
  removeContextBinding,
  resolveContextBinding,
  saveContextBindingState,
  setContextBinding,
  type ContextBinding,
  type GitWorkspaceContext,
} from "../context/bindings.js";
import { assertGitBranchName } from "../git/runner.js";
import { acquireForumLock } from "../storage/lock.js";
import {
  createAgentForumPaths,
  type AgentForumPaths,
} from "../storage/paths.js";
import { ServiceError } from "./errors.js";
import { showRoom, type RoomView } from "./room.js";

export type BindingTargetStatus = "active" | "archived" | "missing" | "unavailable";

export interface ContextTargetView {
  forumId: string;
  forumAlias: string | null;
  roomId: string;
  roomSlug: string | null;
  roomTitle: string | null;
  targetStatus: BindingTargetStatus;
  problem?: string;
}

export interface ContextBindingView extends ContextTargetView {
  binding: ContextBinding;
}

export interface ResolvedContextView extends ContextTargetView {
  source: "explicit" | "branch" | "workspace";
  context: GitWorkspaceContext | null;
  binding: ContextBinding | null;
}

export interface BindContextInput {
  forumAlias: string;
  room: string;
  cwd?: string;
  workspace?: boolean;
  branch?: string;
  force?: boolean;
  now?: Date;
  bindingId?: string;
}

export interface SelectContextInput {
  cwd?: string;
  workspace?: boolean;
  branch?: string;
}

function selectedCwd(cwd?: string): string {
  return resolve(cwd ?? process.cwd());
}

function findForumById(
  config: LocalConfig,
  forumId: string,
): LocalForumRegistration | undefined {
  return config.forums.find((forum) => forum.forumId === forumId);
}

async function targetFromRegistration(
  registration: LocalForumRegistration,
  roomIdOrSlug: string,
  paths: AgentForumPaths,
): Promise<ContextTargetView> {
  try {
    const result = await showRoom(registration.alias, roomIdOrSlug, paths);
    return {
      forumId: registration.forumId,
      forumAlias: registration.alias,
      roomId: result.room.id,
      roomSlug: result.room.slug,
      roomTitle: result.room.title,
      targetStatus: result.room.status,
    };
  } catch (error) {
    if (error instanceof ServiceError && error.code === "ROOM_NOT_FOUND") {
      return {
        forumId: registration.forumId,
        forumAlias: registration.alias,
        roomId: roomIdOrSlug,
        roomSlug: null,
        roomTitle: null,
        targetStatus: "missing",
        problem: error.message,
      };
    }
    return {
      forumId: registration.forumId,
      forumAlias: registration.alias,
      roomId: roomIdOrSlug,
      roomSlug: null,
      roomTitle: null,
      targetStatus: "unavailable",
      problem: error instanceof Error ? error.message : String(error),
    };
  }
}

async function targetForBinding(
  config: LocalConfig,
  binding: ContextBinding,
  paths: AgentForumPaths,
): Promise<ContextBindingView> {
  const registration = findForumById(config, binding.forumId);
  if (!registration) {
    return {
      binding,
      forumId: binding.forumId,
      forumAlias: null,
      roomId: binding.roomId,
      roomSlug: null,
      roomTitle: null,
      targetStatus: "missing",
      problem: "forum is no longer registered locally",
    };
  }
  const target = await targetFromRegistration(registration, binding.roomId, paths);
  return { binding, ...target };
}

async function requireTarget(
  forumAlias: string,
  room: string,
  paths: AgentForumPaths,
  options: { active?: boolean } = {},
): Promise<ContextTargetView> {
  const config = await loadLocalConfig(paths);
  const registration = findForum(config, forumAlias);
  const target = await targetFromRegistration(registration, room, paths);
  if (target.targetStatus === "missing" || target.targetStatus === "unavailable") {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      `context target is unavailable: ${forumAlias}/${room}`,
      target,
    );
  }
  if (options.active && target.targetStatus === "archived") {
    throw new ServiceError(
      "ROOM_ARCHIVED",
      `cannot bind an archived room: ${target.roomId}`,
    );
  }
  return target;
}

function requireBranch(
  context: GitWorkspaceContext,
  requestedBranch: string | undefined,
  cwd: string,
): string {
  const branch = requestedBranch ?? context.branch;
  if (!branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "a branch binding requires an attached HEAD or explicit --branch",
    );
  }
  assertGitBranchName(cwd, branch);
  return branch;
}

export async function bindContext(
  input: BindContextInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{
  action: "created" | "replaced";
  binding: ContextBinding;
  target: ContextTargetView;
}> {
  if (input.workspace && input.branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "--branch cannot be combined with a workspace-default binding",
    );
  }
  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const target = await requireTarget(input.forumAlias, input.room, paths, {
    active: true,
  });
  const scope = input.workspace ? "workspace" : "branch";
  const branch =
    scope === "branch" ? requireBranch(context, input.branch, cwd) : undefined;
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, "context.lock"),
    command: "context bind",
  });
  try {
    const state = await loadContextBindingState(paths);
    const result = setContextBinding(
      state,
      {
        context,
        scope,
        ...(branch ? { branch } : {}),
        forumId: target.forumId,
        roomId: target.roomId,
      },
      {
        ...(input.force !== undefined ? { force: input.force } : {}),
        ...(input.now ? { now: input.now } : {}),
        ...(input.bindingId ? { bindingId: input.bindingId } : {}),
      },
    );
    await saveContextBindingState(paths, result.state);
    return {
      action: result.replaced ? "replaced" : "created",
      binding: result.binding,
      target,
    };
  } finally {
    await lock.release();
  }
}

export async function unbindContext(
  input: SelectContextInput,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ removed: ContextBinding[]; context: GitWorkspaceContext }> {
  if (input.workspace && input.branch) {
    throw new ContextError(
      "GIT_BRANCH_REQUIRED",
      "--branch cannot be combined with a workspace-default binding",
    );
  }
  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const scope = input.workspace ? "workspace" : "branch";
  const branch =
    scope === "branch" ? requireBranch(context, input.branch, cwd) : undefined;
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, "context.lock"),
    command: "context unbind",
  });
  try {
    const state = await loadContextBindingState(paths);
    const result = removeContextBinding(
      state,
      context.workspaceKey,
      scope,
      branch,
    );
    if (result.removed.length > 0) {
      await saveContextBindingState(paths, result.state);
    }
    return { removed: result.removed, context };
  } finally {
    await lock.release();
  }
}

export async function listContextBindings(
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<{ bindings: ContextBindingView[] }> {
  const [state, config] = await Promise.all([
    loadContextBindingState(paths),
    loadLocalConfig(paths),
  ]);
  const bindings = await Promise.all(
    state.bindings.map((binding) => targetForBinding(config, binding, paths)),
  );
  bindings.sort((left, right) => {
    const byWorkspace = left.binding.workspaceKey.localeCompare(
      right.binding.workspaceKey,
    );
    if (byWorkspace) return byWorkspace;
    if (left.binding.scope !== right.binding.scope) {
      return left.binding.scope === "branch" ? -1 : 1;
    }
    const leftBranch = left.binding.scope === "branch" ? left.binding.branch : "";
    const rightBranch = right.binding.scope === "branch" ? right.binding.branch : "";
    return leftBranch.localeCompare(rightBranch);
  });
  return { bindings };
}

export async function resolveContext(
  input: {
    cwd?: string;
    forumAlias?: string;
    room?: string;
  } = {},
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ResolvedContextView> {
  if (Boolean(input.forumAlias) !== Boolean(input.room)) {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      "explicit context requires both forum alias and room",
    );
  }
  if (input.forumAlias && input.room) {
    const target = await requireTarget(input.forumAlias, input.room, paths);
    return {
      ...target,
      source: "explicit",
      context: null,
      binding: null,
    };
  }

  const cwd = selectedCwd(input.cwd);
  const context = await discoverGitWorkspace(cwd);
  const state = await loadContextBindingState(paths);
  const resolution = resolveContextBinding(state, context);
  if (resolution.kind === "unbound") {
    throw new ContextError(
      "CONTEXT_NOT_BOUND",
      "no branch or workspace-default binding matches the current context",
      context,
    );
  }
  const config = await loadLocalConfig(paths);
  const target = await targetForBinding(config, resolution.binding, paths);
  if (target.targetStatus === "missing" || target.targetStatus === "unavailable") {
    throw new ContextError(
      "BINDING_TARGET_UNAVAILABLE",
      `bound context target is ${target.targetStatus}`,
      target,
    );
  }
  return {
    forumId: target.forumId,
    forumAlias: target.forumAlias,
    roomId: target.roomId,
    roomSlug: target.roomSlug,
    roomTitle: target.roomTitle,
    targetStatus: target.targetStatus,
    source: resolution.source,
    context,
    binding: resolution.binding,
  };
}

export async function showContext(
  cwd?: string,
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ResolvedContextView> {
  return resolveContext({ ...(cwd ? { cwd } : {}) }, paths);
}
