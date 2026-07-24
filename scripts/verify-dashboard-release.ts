import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDashboardInstallationStatus, installDashboard, uninstallDashboard, type DashboardReleaseManifest } from "../src/services/dashboard-installer.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDirectory = resolve(root, "dist", "dashboard");
const manifest = JSON.parse(await readFile(resolve(releaseDirectory, "dashboard-manifest.json"), "utf8")) as DashboardReleaseManifest;
const platform = process.platform;
const arch = process.arch;
const asset = manifest.assets.find((candidate) => candidate.platform === platform && candidate.arch === arch);
assert.ok(asset, `manifest does not contain ${platform}-${arch}`);
const archivePath = resolve(releaseDirectory, `${platform}-${arch}`, asset.fileName);
const archive = await readFile(archivePath);
const home = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-release-"));
const paths = createAgentForumPaths(home);
const fetcher = async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith("dashboard-manifest.json")) return Response.json(manifest);
  if (url === asset.url) return new Response(archive, { headers: { "content-length": String(archive.byteLength) } });
  return new Response("not found", { status: 404 });
};
try {
  const installed = await installDashboard({ manifestUrl: "http://127.0.0.1/dashboard-manifest.json", platform, arch, fetcher: fetcher as typeof fetch }, paths);
  assert.equal(installed.installation.version, manifest.version);
  const helper = resolve(dirname(installed.executable), platform === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli");
  assert.ok(Object.keys(installed.installation.files).some((path) => path.endsWith(platform === "win32" ? "/agent-forum-dashboard-cli.exe" : "/agent-forum-dashboard-cli") || path === (platform === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli")), "installation does not contain the no-terminal CLI helper");
  if (platform === "win32") {
    const portableExecutable = await readFile(helper);
    const peOffset = portableExecutable.readUInt32LE(0x3c);
    assert.equal(portableExecutable.toString("ascii", peOffset, peOffset + 4), "PE\0\0");
    assert.equal(portableExecutable.readUInt16LE(peOffset + 24 + 68), 2, "Windows CLI helper must use the GUI subsystem and never allocate a console");
  }
  const helperResult = spawnSync(helper, ["--json", "version"], { encoding: "utf8", shell: false, windowsHide: true, env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(helperResult.status, 0, helperResult.stderr);
  assert.equal(JSON.parse(helperResult.stdout).ok, true);
  assert.equal((await getDashboardInstallationStatus(paths)).status, "installed");
  assert.equal((await uninstallDashboard({}, paths)).action, "uninstalled");
  console.log(`Verified real Dashboard release archive for ${platform}-${arch}: ${asset.fileName}`);
} finally {
  await rm(home, { recursive: true, force: true });
}
