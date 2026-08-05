import { spawnSync } from "node:child_process";

export interface GitCommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export class GitCommandError extends Error {
  constructor(
    readonly code:
      | "GIT_UNAVAILABLE"
      | "GIT_COMMAND_FAILED"
      | "GIT_COMMAND_TIMEOUT"
      | "GIT_DIRTY_WORKTREE"
      | "INVALID_GIT_BRANCH",
    message: string,
    readonly result?: GitCommandResult,
  ) {
    super(message);
    this.name = "GitCommandError";
  }
}

export function redactGitOutput(value: string): string {
  return value
    .replace(/(https?:\/\/)[^/@\s]+@/giu, "$1***@")
    .replace(/(https?:\/\/[^/:\s]+:)[^@\s]+@/giu, "$1***@")
    .replace(/([?&][^=&#\s]+)=([^&#\s]+)/gu, "$1=***")
    .replace(/(https?:\/\/[^#\s]+)#[^\s]+/giu, "$1#***");
}

export interface GitCommandOptions {
  timeoutMs?: number;
}

const defaultGitTimeoutMs = 60_000;

export function runGit(
  cwd: string,
  args: readonly string[],
  options: GitCommandOptions = {},
): GitCommandResult {
  const timeoutMs = options.timeoutMs ?? defaultGitTimeoutMs;
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    const errorCode = (result.error as NodeJS.ErrnoException).code;
    if (errorCode === "ETIMEDOUT") {
      throw new GitCommandError(
        "GIT_COMMAND_TIMEOUT",
        `Git command timed out after ${timeoutMs}ms: git ${redactGitOutput(args.join(" "))}`,
      );
    }
    throw new GitCommandError(
      "GIT_UNAVAILABLE",
      `failed to execute Git: ${result.error.message}`,
    );
  }
  if (result.signal) {
    throw new GitCommandError(
      "GIT_COMMAND_TIMEOUT",
      `Git command was terminated after ${timeoutMs}ms: git ${redactGitOutput(args.join(" "))}`,
    );
  }
  return {
    status: result.status ?? 1,
    stdout: redactGitOutput(result.stdout ?? ""),
    stderr: redactGitOutput(result.stderr ?? ""),
  };
}

export function requireGit(
  cwd: string,
  args: readonly string[],
  options: GitCommandOptions = {},
): GitCommandResult {
  const result = runGit(cwd, args, options);
  if (result.status !== 0) {
    throw new GitCommandError(
      "GIT_COMMAND_FAILED",
      `git ${redactGitOutput(args.join(" "))} failed: ${result.stderr || result.stdout}`,
      result,
    );
  }
  return result;
}

export function assertGitBranchName(cwd: string, branch: string): void {
  const result = runGit(cwd, ["check-ref-format", "--branch", branch]);
  if (result.status !== 0) {
    throw new GitCommandError(
      "INVALID_GIT_BRANCH",
      `invalid Git branch name: ${branch}`,
      result,
    );
  }
}

export function assertCleanWorktree(repository: string): void {
  const status = requireGit(repository, ["status", "--porcelain"]).stdout;
  if (status.trim().length > 0) {
    throw new GitCommandError(
      "GIT_DIRTY_WORKTREE",
      `managed forum worktree is not clean: ${repository}`,
    );
  }
}

export function configureForumCommitIdentity(
  repository: string,
  displayName: string,
  memberId: string,
): void {
  requireGit(repository, [
    "-c",
    "core.longpaths=true",
    "config",
    "core.longpaths",
    "true",
  ]);
  requireGit(repository, ["config", "user.name", displayName]);
  requireGit(repository, [
    "config",
    "user.email",
    `${memberId}@agent-forum.invalid`,
  ]);
  requireGit(repository, ["config", "core.autocrlf", "false"]);
}

export function commitPaths(
  repository: string,
  paths: readonly string[],
  message: string,
): string {
  requireGit(repository, ["add", "--", ...paths]);
  requireGit(repository, ["commit", "-m", message]);
  return requireGit(repository, ["rev-parse", "HEAD"]).stdout.trim();
}
