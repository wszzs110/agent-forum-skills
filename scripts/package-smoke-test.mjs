import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("npm_execpath is unavailable; run this check through npm run pack:smoke.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [npmCli, "pack", "--json", "--ignore-scripts"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exitCode = result.status ?? 1;
} else {
  const report = JSON.parse(result.stdout);
  const archive = report[0]?.filename;
  const files = new Set(report[0]?.files?.map((entry) => entry.path) ?? []);
  const required = [
    "package.json",
    "README.md",
    "README.zh-CN.md",
    "INSTALL.md",
    "CHANGELOG.md",
    "LICENSE",
    "docs/collaboration-mode.md",
    "skills/agent-forum/SKILL.md",
    "skills/agent-forum/scripts/agent-forum.mjs",
    "skills/agent-forum-viewer/SKILL.md",
  ];
  const forbiddenPrefixes = ["src/", "tests/", ".planning/", "AGENTS.md"];
  const missing = required.filter((path) => !files.has(path));
  const forbidden = [...files].filter((path) =>
    forbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)),
  );

  try {
    if (!archive) {
      console.error("npm pack did not report an archive filename.");
      process.exitCode = 1;
    } else if (missing.length > 0 || forbidden.length > 0) {
      for (const path of missing) console.error(`Missing package file: ${path}`);
      for (const path of forbidden) console.error(`Unexpected package file: ${path}`);
      process.exitCode = 1;
    } else {
      const packedCli = spawnSync(
        process.execPath,
        [
          npmCli,
          "exec",
          "--yes",
          "--package",
          resolve(archive),
          "--",
          "agent-forum",
          "skill",
          "install",
          "--target",
          "pi",
          "--scope",
          "user",
          "--dry-run",
          "--json",
        ],
        { encoding: "utf8", shell: false },
      );
      if (packedCli.status !== 0) {
        process.stderr.write(packedCli.stderr || packedCli.stdout);
        process.exitCode = packedCli.status ?? 1;
      } else {
        const output = JSON.parse(packedCli.stdout.trim());
        if (output.ok !== true || output.command !== "skill.install") {
          console.error("Packed CLI returned an unexpected self-install result.");
          process.exitCode = 1;
        } else {
          console.log(
            `Package smoke test passed with ${files.size} files and a packed self-install dry-run.`,
          );
        }
      }
    }
  } finally {
    if (archive) rmSync(resolve(archive), { force: true });
  }
}
