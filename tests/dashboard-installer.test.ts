import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { getDashboardInstallationStatus, inspectDashboardRelease, installDashboard, uninstallDashboard } from "../src/services/dashboard-installer.js";
import { ServiceError } from "../src/services/errors.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-installer-"));
  const source = resolve(root, "source");
  await mkdir(resolve(source, "agent-forum-dashboard"), { recursive: true });
  const executable = Buffer.from("dashboard executable fixture\n");
  await writeFile(resolve(source, "agent-forum-dashboard", "agent-forum-dashboard.exe"), executable);
  await writeFile(resolve(source, "agent-forum-dashboard", "agent-forum-dashboard-cli.exe"), "dashboard helper fixture\n");
  const archive = resolve(root, "dashboard.tar.gz");
  const tar = spawnSync("tar", ["-czf", archive, "-C", source, "agent-forum-dashboard"], { encoding: "utf8", shell: false });
  assert.equal(tar.status, 0, tar.stderr);
  const bytes = await readFile(archive);
  const manifest = {
    formatVersion: 1,
    version: "1.2.3",
    assets: [{
      platform: "win32", arch: "x64", fileName: "agent-forum-dashboard-win32-x64.tar.gz", archiveFormat: "tar.gz",
      executable: "agent-forum-dashboard/agent-forum-dashboard.exe", executableSha256: digest(executable),
      url: "https://example.test/dashboard.tar.gz", sha256: digest(bytes), size: bytes.byteLength,
    }],
  };
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("manifest.json")) return Response.json(manifest);
    if (url === manifest.assets[0]!.url) return new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } });
    return new Response("missing", { status: 404 });
  };
  return { root, bytes, manifest, fetcher: fetcher as typeof fetch };
}

test("Dashboard installer previews, verifies, installs, detects modification, and uninstalls", async () => {
  const item = await fixture();
  const home = resolve(item.root, "home");
  const paths = createAgentForumPaths(home);
  try {
    const preview = await inspectDashboardRelease({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher });
    assert.equal(preview.version, "1.2.3");
    assert.equal((await getDashboardInstallationStatus(paths)).status, "not-installed");
    const installed = await installDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher, now: new Date("2026-07-24T00:00:00.000Z") }, paths);
    assert.equal(installed.action, "installed");
    assert.equal((await getDashboardInstallationStatus(paths)).status, "installed");
    assert.equal((await installDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }, paths)).action, "unchanged");
    item.manifest.version = "1.2.4";
    const updated = await installDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher, update: true }, paths);
    assert.equal(updated.action, "updated");
    assert.equal(updated.installation.version, "1.2.4");
    await chmod(updated.executable, 0o700);
    await writeFile(updated.executable, "modified");
    assert.equal((await getDashboardInstallationStatus(paths)).status, "modified");
    await assert.rejects(uninstallDashboard({}, paths), (error) => error instanceof ServiceError && error.code === "DASHBOARD_INSTALLATION_MODIFIED");
    assert.equal((await uninstallDashboard({ force: true }, paths)).action, "uninstalled");
    assert.equal((await getDashboardInstallationStatus(paths)).status, "not-installed");
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard installer rejects checksum mismatch without exposing an installation", async () => {
  const item = await fixture();
  const paths = createAgentForumPaths(resolve(item.root, "home"));
  item.manifest.assets[0]!.sha256 = "0".repeat(64);
  try {
    await assert.rejects(
      installDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }, paths),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_CHECKSUM_MISMATCH",
    );
    assert.equal((await getDashboardInstallationStatus(paths)).status, "not-installed");
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard release selection rejects unsupported platforms, package-version drift, and unsafe manifests", async () => {
  const item = await fixture();
  try {
    await assert.rejects(
      inspectDashboardRelease({ platform: "win32", arch: "x64", fetcher: item.fetcher, packageVersion: "0.0.8" }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID" && error.message.includes("does not match package version"),
    );
    await assert.rejects(
      inspectDashboardRelease({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "darwin", arch: "arm64", fetcher: item.fetcher }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_PLATFORM_UNSUPPORTED",
    );
    item.manifest.assets[0]!.executable = "../escape.exe";
    await assert.rejects(
      inspectDashboardRelease({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID",
    );
    item.manifest.assets[0]!.executable = "agent-forum-dashboard/agent-forum-dashboard.exe";
    item.manifest.assets[0]!.size = 536_870_913;
    await assert.rejects(
      inspectDashboardRelease({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID",
    );
  } finally { await rm(item.root, { recursive: true, force: true }); }
});
