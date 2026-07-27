import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../src/cli.js";
import { loadLocalConfig } from "../src/config/local-config.js";

async function run(args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const outputs: { stdout: string[]; stderr: string[] } = { stdout: [], stderr: [] };
  const originalCwd = process.cwd();
  if (cwd) process.chdir(cwd);
  try {
    const code = await runCli(args, {
      stdout: (text) => outputs.stdout.push(text),
      stderr: (text) => outputs.stderr.push(text),
    });
    return {
      code,
      stdout: outputs.stdout.join(""),
      stderr: outputs.stderr.join(""),
    };
  } finally {
    if (cwd) process.chdir(originalCwd);
  }
}

describe("setup command", () => {
  let home: string;
  let repo: string;
  let originalHome: string;
  let originalAgents: string | undefined;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "af-setup-home-"));
    repo = await mkdtemp(join(tmpdir(), "af-setup-repo-"));
    originalHome = process.env.HOME ?? "";
    originalAgents = process.env.AGENTS_DIRECTORY;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    delete process.env.AGENTS_DIRECTORY;
    // init git repo for context binding
    await run(["--version"]);
    const { execSync } = await import("node:child_process");
    execSync("git init", { cwd: repo });
    execSync('git config user.email "setup@test"', { cwd: repo });
    execSync('git config user.name "Setup Test"', { cwd: repo });
    await writeFile(join(repo, "README.md"), "# test\n", "utf8");
    execSync("git add README.md", { cwd: repo });
    execSync('git commit -m "init"', { cwd: repo });
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalHome;
    if (originalAgents !== undefined) process.env.AGENTS_DIRECTORY = originalAgents;
    else delete process.env.AGENTS_DIRECTORY;
    await rm(home, { recursive: true, force: true });
    await rm(repo, { recursive: true, force: true });
  });

  it("creates identity, forum, room, publishes identity, joins room, and binds context", async () => {
    const { code, stdout, stderr } = await run(
      [
        "--json",
        "setup",
        "--alias",
        "preview",
        "--name",
        "Preview Forum",
        "--description",
        "A preview forum for setup testing.",
        "--room-slug",
        "validation",
        "--room-title",
        "Validation Room",
        "--room-description",
        "Room created by setup command.",
        "--identity-name",
        "Setup Bot",
        "--identity-role",
        "tester",
        "--identity-responsibility",
        "Validates the setup command.",
        "--workspace",
      ],
      repo,
    );
    if (code !== 0) {
      console.error("stderr:", stderr);
      console.error("stdout:", stdout);
    }
    assert.equal(code, 0, "setup should succeed");
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.command, "setup");
    assert.equal(result.data.identityCreated.displayName, "Setup Bot");
    assert.ok(result.data.forumCreated, "forum should be created");
    assert.ok(result.data.roomCreated || result.data.roomUsed, "room created or used");
    assert.equal(result.data.identityPublished.action, "unchanged", "init-local already publishes the creator; setup republish is unchanged");
    assert.equal(result.data.roomMembership.action, "unchanged", "room creator is auto-joined; setup rejoin is unchanged");
    assert.equal(result.data.contextBound.target.forumAlias, "preview");
    assert.equal(result.data.contextBound.target.roomSlug, "validation");
  });

  it("is idempotent when run twice with the same alias and room slug", async () => {
    const first = await run(
      [
        "--json",
        "setup",
        "--alias",
        "preview",
        "--name",
        "Preview Forum",
        "--description",
        "A preview forum for setup testing.",
        "--room-slug",
        "validation",
        "--room-title",
        "Validation Room",
        "--room-description",
        "Room created by setup command.",
        "--workspace",
      ],
      repo,
    );
    assert.equal(first.code, 0);
    const second = await run(
      [
        "--json",
        "setup",
        "--alias",
        "preview",
        "--name",
        "Preview Forum",
        "--description",
        "A preview forum for setup testing.",
        "--room-slug",
        "validation",
        "--room-title",
        "Validation Room",
        "--room-description",
        "Room created by setup command.",
        "--workspace",
      ],
      repo,
    );
    assert.equal(second.code, 0);
    const result = JSON.parse(second.stdout);
    assert.equal(result.data.identityUsed.memberId, JSON.parse(first.stdout).data.identityCreated.memberId);
    assert.equal(result.data.forumUsed.forumId, JSON.parse(first.stdout).data.forumCreated.forumId);
    assert.equal(result.data.roomUsed.slug, "validation");
    assert.equal(result.data.identityPublished.action, "unchanged");
    assert.equal(result.data.roomMembership.action, "unchanged");
  });

  it("publishes the initial Forum to a supplied remote data branch", async () => {
    const { execSync } = await import("node:child_process");
    const remote = join(home, "setup-remote.git");
    execSync("git init --bare setup-remote.git", { cwd: home });
    const { code, stdout } = await run(
      [
        "--json", "setup",
        "--alias", "remote-setup",
        "--name", "Remote Setup Forum",
        "--description", "Tests initial remote publication.",
        "--room-slug", "delivery",
        "--room-title", "Delivery",
        "--room-description", "Remote setup test room.",
        "--remote", remote,
        "--data-branch", "coordination",
        "--workspace",
      ],
      repo,
    );
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.data.remotePublished.branch, "coordination");
    assert.match(
      execSync("git --git-dir setup-remote.git rev-parse refs/heads/coordination", { cwd: home, encoding: "utf8" }),
      /^[0-9a-f]{40}\s*$/,
    );
  });

  it("clones an existing remote Forum instead of creating a conflicting local root", async () => {
    const { execSync } = await import("node:child_process");
    const remote = join(home, "existing-remote.git");
    execSync("git init --bare existing-remote.git", { cwd: home });
    const owner = await run([
      "--json", "setup",
      "--alias", "owner", "--name", "Owner Forum", "--description", "The authoritative Forum.",
      "--room-slug", "coordination", "--room-title", "Coordination", "--room-description", "Shared Room.",
      "--remote", remote, "--workspace",
    ], repo);
    assert.equal(owner.code, 0);
    const ownerForumId = JSON.parse(owner.stdout).data.forumCreated.forumId;

    const joinHome = await mkdtemp(join(tmpdir(), "af-setup-existing-home-"));
    const joinRepo = await mkdtemp(join(tmpdir(), "af-setup-existing-repo-"));
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    try {
      execSync("git init", { cwd: joinRepo });
      execSync('git config user.email "join@test"', { cwd: joinRepo });
      execSync('git config user.name "Join Test"', { cwd: joinRepo });
      await writeFile(join(joinRepo, "README.md"), "# join\n", "utf8");
      execSync("git add README.md && git commit -m init", { cwd: joinRepo });
      process.env.HOME = joinHome;
      process.env.USERPROFILE = joinHome;
      const joined = await run([
        "--json", "setup",
        "--alias", "joined", "--name", "Must not be used", "--description", "Must not create another Forum.",
        "--room-slug", "coordination", "--room-title", "Coordination", "--room-description", "Shared Room.",
        "--remote", remote, "--workspace",
      ], joinRepo);
      assert.equal(joined.code, 0, `setup failed: ${joined.stdout}\n${joined.stderr}`);
      const result = JSON.parse(joined.stdout);
      assert.equal(result.data.forumAdded.forumId, ownerForumId);
      assert.equal(result.data.forumCreated, undefined);
      assert.ok(result.data.remoteSynced, "setup must publish the joining identity and membership");
      const joinedConfig = await loadLocalConfig();
      assert.equal(joinedConfig.forums.find((forum) => forum.alias === "joined")?.forumId, ownerForumId);
      const joinedHead = execSync("git rev-parse HEAD", { cwd: joinedConfig.forums.find((forum) => forum.alias === "joined")!.path, encoding: "utf8" }).trim();
      const remoteHead = execSync("git --git-dir existing-remote.git rev-parse refs/heads/main", { cwd: home, encoding: "utf8" }).trim();
      assert.equal(joinedHead, remoteHead);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      await rm(joinHome, { recursive: true, force: true });
      await rm(joinRepo, { recursive: true, force: true });
    }
  });

  it("reuses a matching remote and refuses implicit remote replacement", async () => {
    const { execSync } = await import("node:child_process");
    const remote = join(home, "matching-remote.git");
    const replacement = join(home, "replacement-remote.git");
    execSync("git init --bare matching-remote.git", { cwd: home });
    execSync("git init --bare replacement-remote.git", { cwd: home });
    const args = [
      "--json", "setup",
      "--alias", "remote-reuse",
      "--name", "Remote Reuse Forum",
      "--description", "Tests remote reuse.",
      "--room-slug", "coordination",
      "--room-title", "Coordination",
      "--room-description", "Remote reuse test room.",
      "--remote", remote,
      "--workspace",
    ];
    assert.equal((await run(args, repo)).code, 0);

    const repeated = await run(args, repo);
    assert.equal(repeated.code, 0);
    assert.equal(JSON.parse(repeated.stdout).data.remoteUsed.remote, "<local-path>");

    const changed = [...args];
    changed[changed.indexOf(remote)] = replacement;
    const mismatch = await run(changed, repo);
    assert.notEqual(mismatch.code, 0);
    assert.equal(JSON.parse(mismatch.stdout).error.code, "REMOTE_ALREADY_CONFIGURED");
  });

  it("separates the Forum data branch from the workspace bind branch", async () => {
    const { execSync } = await import("node:child_process");
    const currentBranch = execSync("git branch --show-current", { cwd: repo, encoding: "utf8" }).trim();
    const { code, stdout } = await run(
      [
        "--json", "setup",
        "--alias", "branch-test",
        "--name", "Branch Test Forum",
        "--description", "Tests distinct data and workspace branches.",
        "--room-slug", "coordination",
        "--room-title", "Coordination",
        "--room-description", "Branch semantics test room.",
        "--data-branch", "forum-data",
        "--bind-branch", currentBranch,
      ],
      repo,
    );
    assert.equal(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    const config = await loadLocalConfig();
    assert.equal(config.forums.find((forum) => forum.alias === "branch-test")?.dataBranch, "forum-data");
    const resolved = JSON.parse((await run(["--json", "context", "resolve"], repo)).stdout);
    assert.equal(resolved.data.source, "branch");
    assert.equal(resolved.data.context.branch, currentBranch);
  });

  it("rejects ambiguous or legacy branch options", async () => {
    const conflict = await run(["--json", "setup", "--workspace", "--bind-branch", "main"]);
    assert.notEqual(conflict.code, 0);
    assert.equal(JSON.parse(conflict.stdout).error.code, "INVALID_ARGUMENT");
    assert.match(JSON.parse(conflict.stdout).error.message, /--workspace and --bind-branch/);

    const legacy = await run(["--json", "setup", "--branch", "main"]);
    assert.notEqual(legacy.code, 0);
    assert.equal(JSON.parse(legacy.stdout).error.code, "INVALID_ARGUMENT");
    assert.match(JSON.parse(legacy.stdout).error.message, /unknown option: --branch/);
  });

  it("rejects missing required options", async () => {
    const { code, stdout } = await run(["--json", "setup", "--alias", "x"]);
    assert.notEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_ARGUMENT");
  });
});
