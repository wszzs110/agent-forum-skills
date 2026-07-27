import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { getDashboardInstallationStatus, inspectDashboardRelease, installDashboard, uninstallDashboard, validateDashboardArchiveEntries } from "../src/services/dashboard-installer.js";
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
    const modified = await getDashboardInstallationStatus(paths);
    assert.equal(modified.status, "modified");
    assert.deepEqual(modified.modifiedFiles, ["agent-forum-dashboard/agent-forum-dashboard.exe"], "modification diagnostics are relative to the installation root");
    await assert.rejects(uninstallDashboard({}, paths), (error) => error instanceof ServiceError && error.code === "DASHBOARD_INSTALLATION_MODIFIED");
    assert.equal((await uninstallDashboard({ force: true }, paths)).action, "uninstalled");
    assert.equal((await getDashboardInstallationStatus(paths)).status, "not-installed");
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard download permits slow transfers that continue making progress", async () => {
  const item = await fixture();
  const paths = createAgentForumPaths(resolve(item.root, "home"));
  const slowFetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("manifest.json")) return Response.json(item.manifest);
    if (url === item.manifest.assets[0]!.url) {
      const bytes = item.bytes;
      const chunkSize = Math.ceil(bytes.byteLength / 4);
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
            controller.enqueue(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-length": String(bytes.byteLength) } });
    }
    return new Response("missing", { status: 404 });
  };
  try {
    const result = await installDashboard({
      manifestUrl: "http://127.0.0.1/manifest.json",
      platform: "win32",
      arch: "x64",
      fetcher: slowFetcher as typeof fetch,
      downloadTimeouts: { assetConnectionMs: 10, assetInactivityMs: 50 },
    }, paths);
    assert.equal(result.action, "installed");
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard download aborts a stalled connection and retries", async () => {
  const item = await fixture();
  const paths = createAgentForumPaths(resolve(item.root, "home"));
  const stalledFetcher = ((input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith("manifest.json")) return Promise.resolve(Response.json(item.manifest));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
    });
  }) as typeof fetch;
  try {
    await assert.rejects(
      installDashboard({
        manifestUrl: "http://127.0.0.1/manifest.json",
        platform: "win32",
        arch: "x64",
        fetcher: stalledFetcher,
        downloadTimeouts: { assetConnectionMs: 10, assetInactivityMs: 50 },
      }, paths),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_DOWNLOAD_FAILED" && error.message === "Dashboard release asset connection timed out",
    );
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard status repeatedly hashes installed files without double-closing handles", async () => {
  const item = await fixture();
  const paths = createAgentForumPaths(resolve(item.root, "home"));
  try {
    await installDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }, paths);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal((await getDashboardInstallationStatus(paths)).status, "installed");
    }
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard status compares symlink targets against the canonical installation root", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-canonical-root-"));
  const actualHome = resolve(root, "actual-home");
  const aliasHome = resolve(root, "alias-home");
  await mkdir(actualHome, { recursive: true });
  await symlink(actualHome, aliasHome, "dir");
  const paths = createAgentForumPaths(aliasHome);
  const app = resolve(paths.dashboardInstallDirectory, "Dashboard.app");
  const executable = resolve(app, "dashboard");
  const versionDirectory = resolve(app, "Framework.framework", "Versions", "A");
  try {
    await mkdir(versionDirectory, { recursive: true });
    await writeFile(executable, "dashboard\n");
    await writeFile(resolve(versionDirectory, "framework"), "framework\n");
    await symlink("A", resolve(app, "Framework.framework", "Versions", "Current"));
    await writeFile(paths.dashboardInstallationFile, `${JSON.stringify({
      formatVersion: 1,
      version: "1.2.3",
      platform: "darwin",
      arch: "arm64",
      executable: "Dashboard.app/dashboard",
      executableSha256: digest("dashboard\n"),
      files: {
        "Dashboard.app/dashboard": digest("dashboard\n"),
        "Dashboard.app/Framework.framework/Versions/A/framework": digest("framework\n"),
        "Dashboard.app/Framework.framework/Versions/Current": digest("symlink:A"),
      },
      sourceUrl: "https://example.test/dashboard.tar.gz",
      installedAt: "2026-07-24T00:00:00.000Z",
    }, null, 2)}\n`);
    assert.equal((await getDashboardInstallationStatus(paths)).status, "installed");
  } finally { await rm(root, { recursive: true, force: true }); }
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

test("Dashboard archive validation permits only internal relative symbolic links", () => {
  const entries = [
    "./",
    "./Dashboard.app/",
    "./Dashboard.app/Framework.framework/",
    "./Dashboard.app/Framework.framework/Versions/",
    "./Dashboard.app/Framework.framework/Versions/A/",
    "./Dashboard.app/Framework.framework/Versions/A/Resources/",
    "./Dashboard.app/Framework.framework/Versions/Current",
    "./Dashboard.app/Framework.framework/Resources",
  ];
  const verbose = [
    "drwxr-xr-x 0/0 0 date ./",
    "drwxr-xr-x 0/0 0 date ./Dashboard.app/",
    "drwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/",
    "drwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/Versions/",
    "drwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/Versions/A/",
    "drwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/Versions/A/Resources/",
    "lrwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/Versions/Current -> A",
    "lrwxr-xr-x 0/0 0 date ./Dashboard.app/Framework.framework/Resources -> Versions/Current/Resources",
  ];
  assert.doesNotThrow(() => validateDashboardArchiveEntries(entries, verbose));
  assert.throws(() => validateDashboardArchiveEntries(["./link"], ["lrwxr-xr-x 0/0 0 date ./link -> /tmp/outside"]), ServiceError);
  assert.throws(() => validateDashboardArchiveEntries(["./nested/link"], ["lrwxr-xr-x 0/0 0 date ./nested/link -> ../../outside"]), ServiceError);
  assert.throws(() => validateDashboardArchiveEntries(["./hard"], ["hrwxr-xr-x 0/0 0 date ./hard link to ./target"]), ServiceError);
  assert.throws(() => validateDashboardArchiveEntries(["./link", "./link/payload"], ["lrwxr-xr-x 0/0 0 date ./link -> target", "-rw-r--r-- 0/0 1 date ./link/payload"]), ServiceError);
});

test("Dashboard release selection uses an independent Dashboard version", async () => {
  const item = await fixture();
  let manifestUrl = "";
  const fetcher = (async (input: string | URL | Request) => {
    manifestUrl = String(input);
    return item.fetcher(input);
  }) as typeof fetch;
  try {
    const release = await inspectDashboardRelease({ dashboardVersion: "1.2.3", platform: "win32", arch: "x64", fetcher });
    assert.equal(release.version, "1.2.3");
    assert.match(manifestUrl, /releases\/download\/v1\.2\.3\/dashboard-manifest\.json$/u);
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard release selection rejects unsupported platforms, Dashboard-version drift, and unsafe manifests", async () => {
  const item = await fixture();
  try {
    await assert.rejects(
      inspectDashboardRelease({ platform: "win32", arch: "x64", fetcher: item.fetcher, packageVersion: "0.0.8" }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID" && error.message.includes("does not match the required Dashboard version"),
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
    item.manifest.assets[0]!.size = 2_147_483_649;
    await assert.rejects(
      inspectDashboardRelease({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }),
      (error) => error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID",
    );
  } finally { await rm(item.root, { recursive: true, force: true }); }
});
