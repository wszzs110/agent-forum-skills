import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  appendFile,
  cp,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  SkillInstallationError,
  doctorSkill,
  dashboardSkillDestination,
  getSkillStatus,
  installSkill,
  skillDestination,
  uninstallSkill,
  viewerSkillDestination,
} from "../src/skill/installer.js";

const sourceDirectory = resolve("skills", "agent-forum");

async function doesNotExist(path: string): Promise<boolean> {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

test("dry-run reports the destination without writing user files", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-install-dry-"));
  try {
    const result = await installSkill({
      target: "pi",
      homeDirectory: home,
      sourceDirectory,
      dryRun: true,
    });

    assert.equal(result.action, "would-install");
    assert.equal(result.destination, skillDestination("pi", home));
    assert.equal(await doesNotExist(resolve(home, ".agents")), true);
    assert.equal(await doesNotExist(resolve(home, ".AgentForum")), true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("common targets share one managed payload and uninstall safely", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-install-common-"));
  const destination = skillDestination("pi", home);

  try {
    const first = await installSkill({
      target: "pi",
      homeDirectory: home,
      sourceDirectory,
      now: "2026-07-12T18:00:00.000Z",
    });
    assert.equal(first.action, "installed");
    assert.equal((await getSkillStatus("pi", home)).status, "installed");
    assert.equal(first.destinations.length, 2);
    assert.equal(
      await readFile(resolve(destination, "SKILL.md"), "utf8"),
      await readFile(resolve(sourceDirectory, "SKILL.md"), "utf8"),
    );

    assert.equal(
      await readFile(resolve(viewerSkillDestination("pi", home), "SKILL.md"), "utf8"),
      await readFile(resolve("skills", "agent-forum-viewer", "SKILL.md"), "utf8"),
    );

    assert.equal(await doesNotExist(dashboardSkillDestination("pi", home)), true);

    const bundledCli = resolve(destination, "scripts", "agent-forum.mjs");
    const cli = spawnSync(process.execPath, [bundledCli, "--version", "--json"], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).data.name, "agent-forum");

    const second = await installSkill({
      target: "codex",
      homeDirectory: home,
      sourceDirectory,
      now: "2026-07-12T18:01:00.000Z",
    });
    assert.equal(second.action, "installed");
    assert.equal(second.destination, destination);
    assert.equal(
      await readFile(resolve(dashboardSkillDestination("codex", home), "SKILL.md"), "utf8"),
      await readFile(resolve("skills", "agent-forum-dashboard", "SKILL.md"), "utf8"),
    );
    assert.equal((await getSkillStatus("codex", home)).status, "installed");

    const doctor = await doctorSkill("pi", home);
    assert.equal(doctor.ok, true);
    assert.equal(doctor.node.ok, true);
    assert.equal(doctor.git.ok, true);

    const removePi = await uninstallSkill({ target: "pi", homeDirectory: home });
    assert.equal(removePi.action, "unregistered");
    assert.equal(removePi.removedFiles, false);
    assert.equal((await getSkillStatus("pi", home)).status, "unmanaged");
    assert.equal((await getSkillStatus("codex", home)).status, "installed");

    await appendFile(resolve(destination, "SKILL.md"), "\nUser modification.\n", "utf8");
    assert.equal((await getSkillStatus("codex", home)).status, "modified");
    await assert.rejects(
      uninstallSkill({ target: "codex", homeDirectory: home }),
      (error) =>
        error instanceof SkillInstallationError &&
        error.code === "INSTALLATION_MODIFIED",
    );

    const forced = await uninstallSkill({
      target: "codex",
      homeDirectory: home,
      force: true,
    });
    assert.equal(forced.action, "uninstalled");
    assert.equal(forced.removedFiles, true);
    assert.equal(await doesNotExist(destination), true);
    assert.equal(await doesNotExist(viewerSkillDestination("codex", home)), true);
    assert.equal(await doesNotExist(dashboardSkillDestination("codex", home)), true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Claude Code uses its own discovery directory", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-install-claude-"));
  try {
    const result = await installSkill({
      target: "claude-code",
      homeDirectory: home,
      sourceDirectory,
    });
    assert.equal(
      result.destination,
      resolve(home, ".claude", "skills", "agent-forum"),
    );
    assert.equal((await getSkillStatus("claude-code", home)).status, "installed");
    assert.equal(
      result.destinations.includes(resolve(home, ".claude", "skills", "agent-forum-viewer")),
      true,
    );
    assert.equal(result.destinations.includes(resolve(home, ".claude", "skills", "agent-forum-dashboard")), true);

    const removed = await uninstallSkill({
      target: "claude-code",
      homeDirectory: home,
    });
    assert.equal(removed.action, "uninstalled");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Pi excludes the duplicate Dashboard Skill while other targets discover all Skills", async () => {
  for (const target of ["pi", "opencode", "codex", "claude-code"] as const) {
    const home = await mkdtemp(join(tmpdir(), `agent-forum-matrix-${target}-`));
    try {
      const result = await installSkill({ target, homeDirectory: home, sourceDirectory });
      assert.equal(result.destinations.length, target === "pi" ? 2 : 3);
      assert.equal((await getSkillStatus(target, home)).status, "installed");
      const viewer = await readFile(resolve(viewerSkillDestination(target, home), "SKILL.md"), "utf8");
      assert.match(viewer, /name: agent-forum-viewer/u);
      if (target === "pi") {
        assert.equal(await doesNotExist(dashboardSkillDestination(target, home)), true);
      } else {
        const dashboard = await readFile(resolve(dashboardSkillDestination(target, home), "SKILL.md"), "utf8");
        assert.match(dashboard, /name: agent-forum-dashboard/u);
      }
      const cli = spawnSync(process.execPath, [resolve(skillDestination(target, home), "scripts", "agent-forum.mjs"), "viewer", "help", "--json"], { encoding: "utf8", shell: false });
      assert.equal(cli.status, 0, cli.stderr);
      assert.equal(JSON.parse(cli.stdout).command, "viewer.help");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }
});

test("an unmodified managed suite upgrades without force", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-upgrade-"));
  const home = resolve(root, "home");
  const suite = resolve(root, "skills");
  const coreSource = resolve(suite, "agent-forum");
  try {
    await cp(sourceDirectory, coreSource, { recursive: true });
    await cp(resolve("skills", "agent-forum-viewer"), resolve(suite, "agent-forum-viewer"), { recursive: true });
    await cp(resolve("skills", "agent-forum-dashboard"), resolve(suite, "agent-forum-dashboard"), { recursive: true });
    await installSkill({ target: "pi", homeDirectory: home, sourceDirectory: coreSource });
    await appendFile(resolve(coreSource, "SKILL.md"), "\nUpgrade marker.\n", "utf8");

    const preview = await installSkill({
      target: "pi",
      homeDirectory: home,
      sourceDirectory: coreSource,
      dryRun: true,
    });
    assert.equal(preview.action, "would-update");

    const updated = await installSkill({
      target: "pi",
      homeDirectory: home,
      sourceDirectory: coreSource,
    });
    assert.equal(updated.action, "updated");
    assert.equal((await getSkillStatus("pi", home)).status, "installed");
    assert.match(
      await readFile(resolve(skillDestination("pi", home), "SKILL.md"), "utf8"),
      /Upgrade marker/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unmanaged conflicting destination is never overwritten implicitly", async () => {
  const home = await mkdtemp(join(tmpdir(), "agent-forum-install-conflict-"));
  const destination = skillDestination("opencode", home);
  try {
    await installSkill({
      target: "opencode",
      homeDirectory: home,
      sourceDirectory,
    });
    await appendFile(resolve(destination, "SKILL.md"), "\nModified.\n", "utf8");

    await assert.rejects(
      installSkill({
        target: "opencode",
        homeDirectory: home,
        sourceDirectory,
      }),
      (error) =>
        error instanceof SkillInstallationError &&
        error.code === "INSTALLATION_CONFLICT",
    );

    const dryRun = await installSkill({
      target: "opencode",
      homeDirectory: home,
      sourceDirectory,
      dryRun: true,
      force: true,
    });
    assert.equal(dryRun.action, "would-replace");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
