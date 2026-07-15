import { spawnSync } from "node:child_process";

export interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

export class GitExperimentError extends Error {
  constructor(
    readonly code:
      | "GIT_UNAVAILABLE"
      | "PUSH_FAILED"
      | "FETCH_FAILED"
      | "REBASE_FAILED",
    message: string,
    readonly result?: GitResult,
  ) {
    super(message);
    this.name = "GitExperimentError";
  }
}

export type PushResult =
  | { kind: "pushed"; attempts: number; head: string }
  | { kind: "conflict"; attempts: number; files: string[] };

function redact(value: string): string {
  return value
    .replace(/(https?:\/\/)[^/@\s]+@/giu, "$1***@")
    .replace(/(https?:\/\/[^/:\s]+:)[^@\s]+@/giu, "$1***@");
}

export function runGit(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new GitExperimentError(
      "GIT_UNAVAILABLE",
      `failed to execute Git: ${result.error.message}`,
    );
  }

  return {
    status: result.status ?? 1,
    stdout: redact(result.stdout ?? ""),
    stderr: redact(result.stderr ?? ""),
  };
}

export function requireGit(cwd: string, args: readonly string[]): GitResult {
  const result = runGit(cwd, args);
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return result;
}

export function configureExperimentIdentity(
  repository: string,
  name: string,
): void {
  requireGit(repository, ["config", "user.name", name]);
  requireGit(repository, ["config", "user.email", `${name}@example.invalid`]);
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

function isNonFastForward(result: GitResult): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    output.includes("non-fast-forward") ||
    output.includes("fetch first") ||
    (output.includes("[rejected]") && output.includes("failed to push"))
  );
}

export function pushWithRebaseRetry(
  repository: string,
  branch = "main",
  maxAttempts = 3,
): PushResult {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const push = runGit(repository, ["push", "origin", branch]);
    if (push.status === 0) {
      return {
        kind: "pushed",
        attempts: attempt,
        head: requireGit(repository, ["rev-parse", "HEAD"]).stdout.trim(),
      };
    }

    if (!isNonFastForward(push)) {
      throw new GitExperimentError(
        "PUSH_FAILED",
        `push failed without a retryable non-fast-forward: ${push.stderr || push.stdout}`,
        push,
      );
    }

    const fetch = runGit(repository, ["fetch", "origin", branch]);
    if (fetch.status !== 0) {
      throw new GitExperimentError(
        "FETCH_FAILED",
        `fetch failed: ${fetch.stderr || fetch.stdout}`,
        fetch,
      );
    }

    const rebase = runGit(repository, ["rebase", `origin/${branch}`]);
    if (rebase.status !== 0) {
      const conflicts = runGit(repository, [
        "diff",
        "--name-only",
        "--diff-filter=U",
      ]).stdout
        .split(/\r?\n/u)
        .filter(Boolean);
      runGit(repository, ["rebase", "--abort"]);
      if (conflicts.length === 0) {
        throw new GitExperimentError(
          "REBASE_FAILED",
          `rebase failed without conflicted files: ${rebase.stderr || rebase.stdout}`,
          rebase,
        );
      }
      return { kind: "conflict", attempts: attempt, files: conflicts };
    }
  }

  throw new GitExperimentError(
    "PUSH_FAILED",
    `push did not converge after ${maxAttempts} attempts`,
  );
}
