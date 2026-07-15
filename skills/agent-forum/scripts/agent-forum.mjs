#!/usr/bin/env node

// src/errors.ts
var ExitCode = {
  Success: 0,
  Unexpected: 1,
  Usage: 2
};

// src/skill/installer.ts
import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// src/version.ts
var PACKAGE_NAME = "agent-forum-skills";
var CLI_NAME = "agent-forum";
var VERSION = true ? "0.0.0" : "0.0.0-dev";

// src/skill/installer.ts
var SkillInstallationError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "SkillInstallationError";
  }
};
var commonTargets = /* @__PURE__ */ new Set(["pi", "opencode", "codex"]);
function emptyState() {
  return { formatVersion: 1, installations: [] };
}
function stateFile(homeDirectory) {
  return resolve(homeDirectory, ".AgentForum", "state", "installations.json");
}
function skillDestination(target, homeDirectory = homedir()) {
  if (commonTargets.has(target)) {
    return resolve(homeDirectory, ".agents", "skills", "agent-forum");
  }
  if (target === "claude-code") {
    return resolve(homeDirectory, ".claude", "skills", "agent-forum");
  }
  throw new SkillInstallationError("INVALID_TARGET", `unsupported target: ${target}`);
}
async function pathExists(path) {
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
async function loadState(homeDirectory) {
  try {
    const parsed = JSON.parse(await readFile(stateFile(homeDirectory), "utf8"));
    if (parsed.formatVersion !== 1 || !Array.isArray(parsed.installations)) {
      throw new SkillInstallationError(
        "INVALID_INSTALLATION_STATE",
        "unsupported or invalid installation state"
      );
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyState();
    }
    throw error;
  }
}
async function saveState(homeDirectory, state) {
  const destination = stateFile(homeDirectory);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}
`, {
      encoding: "utf8",
      flag: "wx"
    });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
async function collectFiles(root, current = root, allowSymbolicLinks = false) {
  const files = {};
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isSymbolicLink()) {
      if (!allowSymbolicLinks) {
        throw new SkillInstallationError(
          "INSTALLATION_CONFLICT",
          `symbolic links are not allowed in the managed skill payload: ${absolute}`
        );
      }
      const relativePath2 = relative(root, absolute).split(sep).join("/");
      files[relativePath2] = "SYMLINK";
      continue;
    }
    if (entry.isDirectory()) {
      Object.assign(
        files,
        await collectFiles(root, absolute, allowSymbolicLinks)
      );
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = relative(root, absolute).split(sep).join("/");
    files[relativePath] = createHash("sha256").update(await readFile(absolute)).digest("hex");
  }
  return files;
}
function sameFiles(left, right) {
  const leftEntries = Object.entries(left).sort();
  const rightEntries = Object.entries(right).sort();
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}
async function resolveSkillSource(explicit) {
  const candidates = [
    explicit,
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    resolve(process.cwd(), "skills", "agent-forum")
  ].filter((candidate) => Boolean(candidate));
  for (const candidate of candidates) {
    if (await pathExists(resolve(candidate, "SKILL.md"))) return candidate;
  }
  throw new SkillInstallationError(
    "SKILL_SOURCE_NOT_FOUND",
    "could not locate skills/agent-forum/SKILL.md"
  );
}
async function replaceDirectory(source, destination) {
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
    if (movedExisting && !await pathExists(destination)) {
      await rename(backup, destination);
    }
    throw error;
  }
}
async function installSkill(options) {
  const homeDirectory = options.homeDirectory ?? homedir();
  const source = await resolveSkillSource(options.sourceDirectory);
  const destination = skillDestination(options.target, homeDirectory);
  const sourceFiles = await collectFiles(source);
  const destinationExists = await pathExists(destination);
  const destinationFiles = destinationExists ? await collectFiles(destination, destination, true) : void 0;
  const unchanged = destinationFiles ? sameFiles(sourceFiles, destinationFiles) : false;
  if (destinationExists && !unchanged && !options.force) {
    throw new SkillInstallationError(
      "INSTALLATION_CONFLICT",
      `destination exists with different files: ${destination}`
    );
  }
  if (options.dryRun) {
    return {
      action: destinationExists ? unchanged ? "unchanged" : "would-replace" : "would-install",
      target: options.target,
      destination,
      version: VERSION,
      files: Object.keys(sourceFiles).length,
      requiresReload: true
    };
  }
  if (!unchanged) await replaceDirectory(source, destination);
  const state = await loadState(homeDirectory);
  const existing = state.installations.find(
    (installation) => installation.path === destination
  );
  const now = options.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const targets2 = [.../* @__PURE__ */ new Set([...existing?.targets ?? [], options.target])].sort();
  const record = {
    path: destination,
    targets: targets2,
    version: VERSION,
    files: sourceFiles,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now
  };
  const installations = existing ? state.installations.map(
    (installation) => installation.path === destination ? record : installation
  ) : [...state.installations, record];
  await saveState(homeDirectory, { formatVersion: 1, installations });
  return {
    action: unchanged ? "unchanged" : "installed",
    target: options.target,
    destination,
    version: VERSION,
    files: Object.keys(sourceFiles).length,
    requiresReload: true
  };
}
async function getSkillStatus(target, homeDirectory = homedir()) {
  const destination = skillDestination(target, homeDirectory);
  const state = await loadState(homeDirectory);
  const record = state.installations.find(
    (installation) => installation.path === destination && installation.targets.includes(target)
  );
  if (!await pathExists(destination)) {
    return { target, destination, status: "not-installed" };
  }
  if (!record) return { target, destination, status: "unmanaged" };
  const files = await collectFiles(destination, destination, true);
  return {
    target,
    destination,
    status: sameFiles(files, record.files) ? "installed" : "modified",
    version: record.version,
    files: Object.keys(record.files).length
  };
}
async function uninstallSkill(options) {
  const homeDirectory = options.homeDirectory ?? homedir();
  const destination = skillDestination(options.target, homeDirectory);
  const state = await loadState(homeDirectory);
  const record = state.installations.find(
    (installation) => installation.path === destination && installation.targets.includes(options.target)
  );
  if (!record) {
    return {
      action: "not-installed",
      target: options.target,
      destination,
      removedFiles: false
    };
  }
  const remainingTargets = record.targets.filter(
    (target) => target !== options.target
  );
  const shouldRemoveFiles = remainingTargets.length === 0;
  if (shouldRemoveFiles && await pathExists(destination)) {
    const currentFiles = await collectFiles(destination, destination, true);
    if (!sameFiles(currentFiles, record.files) && !options.force) {
      throw new SkillInstallationError(
        "INSTALLATION_MODIFIED",
        `installed skill contains modified or additional files: ${destination}`
      );
    }
  }
  if (options.dryRun) {
    return {
      action: "would-uninstall",
      target: options.target,
      destination,
      removedFiles: shouldRemoveFiles
    };
  }
  if (shouldRemoveFiles) {
    await rm(destination, { recursive: true, force: true });
  }
  const installations = shouldRemoveFiles ? state.installations.filter((installation) => installation.path !== destination) : state.installations.map(
    (installation) => installation.path === destination ? { ...installation, targets: remainingTargets } : installation
  );
  await saveState(homeDirectory, { formatVersion: 1, installations });
  return {
    action: shouldRemoveFiles ? "uninstalled" : "unregistered",
    target: options.target,
    destination,
    removedFiles: shouldRemoveFiles
  };
}
async function doctorSkill(target, homeDirectory = homedir()) {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const git = spawnSync("git", ["--version"], {
    encoding: "utf8",
    shell: false
  });
  const installation = await getSkillStatus(target, homeDirectory);
  const node = { ok: major >= 20, version: process.versions.node, required: ">=20" };
  const gitResult = git.status === 0 ? { ok: true, version: (git.stdout ?? "").trim() } : { ok: false };
  return {
    ok: node.ok && gitResult.ok && installation.status === "installed",
    node,
    git: gitResult,
    installation
  };
}

// src/commands/skill.ts
var targets = /* @__PURE__ */ new Set([
  "pi",
  "opencode",
  "codex",
  "claude-code"
]);
function usageError(message) {
  return {
    exitCode: ExitCode.Usage,
    command: "skill",
    error: { code: "INVALID_ARGUMENT", message },
    human: `Error [INVALID_ARGUMENT]: ${message}
`
  };
}
function parseOptions(args) {
  const parsed = {
    scope: "user",
    dryRun: false,
    force: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (argument === "--force") {
      parsed.force = true;
      continue;
    }
    if (argument === "--target") {
      const value = args[index + 1];
      if (!value || !targets.has(value)) {
        return usageError(
          "--target must be one of: pi, opencode, codex, claude-code"
        );
      }
      parsed.target = value;
      index += 1;
      continue;
    }
    if (argument === "--scope") {
      const value = args[index + 1];
      if (value !== "user") {
        return usageError("only --scope user is supported in the technical preview");
      }
      index += 1;
      continue;
    }
    return usageError(`unknown skill option: ${argument}`);
  }
  if (!parsed.target) return usageError("--target is required");
  return { ...parsed, target: parsed.target };
}
async function executeSkillCommand(args) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    return {
      exitCode: ExitCode.Success,
      command: "skill.help",
      data: {
        usage: "agent-forum skill <install|uninstall|status|doctor> --target <platform> [--scope user] [--dry-run] [--force]"
      },
      human: `Skill management

Usage:
  agent-forum skill <install|uninstall|status|doctor> --target <platform> [options]

Targets:
  pi, opencode, codex, claude-code

Options:
  --scope user  Install for the current user (default)
  --dry-run     Show changes without writing files
  --force       Replace or remove modified managed files
`
    };
  }
  if (!["install", "uninstall", "status", "doctor"].includes(subcommand)) {
    return usageError(`unknown skill subcommand: ${subcommand}`);
  }
  const options = parseOptions(args.slice(1));
  if ("exitCode" in options) return options;
  try {
    if (subcommand === "install") {
      const result2 = await installSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: "skill.install",
        data: result2,
        human: `${result2.action}: ${result2.destination}
Reload the agent to discover the skill.
`
      };
    }
    if (subcommand === "uninstall") {
      const result2 = await uninstallSkill(options);
      return {
        exitCode: ExitCode.Success,
        command: "skill.uninstall",
        data: result2,
        human: `${result2.action}: ${result2.destination}
`
      };
    }
    if (subcommand === "status") {
      const result2 = await getSkillStatus(options.target);
      return {
        exitCode: ExitCode.Success,
        command: "skill.status",
        data: result2,
        human: `${result2.status}: ${result2.destination}
`
      };
    }
    const result = await doctorSkill(options.target);
    return {
      exitCode: result.ok ? ExitCode.Success : ExitCode.Unexpected,
      command: "skill.doctor",
      data: result,
      human: `${result.ok ? "healthy" : "unhealthy"}: ${result.installation.destination}
`
    };
  } catch (error) {
    if (error instanceof SkillInstallationError) {
      return {
        exitCode: error.code === "INVALID_TARGET" ? ExitCode.Usage : ExitCode.Unexpected,
        command: `skill.${subcommand}`,
        error: { code: error.code, message: error.message },
        human: `Error [${error.code}]: ${error.message}
`
      };
    }
    throw error;
  }
}

// src/output/result.ts
function success(command, data) {
  return { ok: true, command, data };
}
function failure(code, message) {
  return { ok: false, error: { code, message } };
}

// src/cli.ts
var defaultIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text)
};
var helpText = `agent-forum \u2014 Git-based collaboration for software development agents

Usage:
  agent-forum [--json] <command>

Commands:
  help, --help       Show this help message
  version, --version Show the CLI version
  skill              Install, inspect, diagnose, or uninstall the Agent Skill

Options:
  --json             Emit a stable machine-readable result
`;
function writeJson(io, value) {
  io.stdout(`${JSON.stringify(value)}
`);
}
async function runCli(args, io = defaultIo) {
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  const command = positional[0];
  if (command === void 0 || command === "help" || command === "--help" || command === "-h") {
    if (json) {
      writeJson(
        io,
        success("help", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION,
          usage: "agent-forum [--json] <command>",
          commands: ["help", "version", "skill"]
        })
      );
    } else {
      io.stdout(helpText);
    }
    return ExitCode.Success;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    if (json) {
      writeJson(
        io,
        success("version", {
          name: CLI_NAME,
          packageName: PACKAGE_NAME,
          version: VERSION
        })
      );
    } else {
      io.stdout(`${CLI_NAME} ${VERSION}
`);
    }
    return ExitCode.Success;
  }
  if (command === "skill") {
    try {
      const execution = await executeSkillCommand(positional.slice(1));
      if (json) {
        writeJson(
          io,
          execution.error ? failure(execution.error.code, execution.error.message) : success(execution.command, execution.data)
        );
      } else if (execution.error) {
        io.stderr(execution.human);
      } else {
        io.stdout(execution.human);
      }
      return execution.exitCode;
    } catch {
      const unexpected = failure(
        "UNEXPECTED_ERROR",
        "The skill operation failed unexpectedly. Run with a trusted package and check filesystem permissions."
      );
      if (json) writeJson(io, unexpected);
      else io.stderr(`Error [${unexpected.error.code}]: ${unexpected.error.message}
`);
      return ExitCode.Unexpected;
    }
  }
  const result = failure(
    "UNKNOWN_COMMAND",
    `Unknown command: ${command}. Run '${CLI_NAME} --help' for usage.`
  );
  if (json) {
    writeJson(io, result);
  } else {
    io.stderr(`Error [${result.error.code}]: ${result.error.message}
`);
  }
  return ExitCode.Usage;
}

// src/main.ts
var exitCode = await runCli(process.argv.slice(2));
process.exitCode = exitCode;
