import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.js";
import { ensureDashboard } from "../src/services/dashboard-ensure.js";
import { getDashboardAcquisitionPolicy, setDashboardAcquisitionPolicy } from "../src/services/dashboard-policy.js";
import { createAgentForumPaths } from "../src/storage/paths.js";

const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

async function dashboardFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-ensure-"));
  const source = resolve(root, "source", "agent-forum-dashboard");
  await mkdir(source, { recursive: true });
  const executable = Buffer.from("dashboard ensure fixture\n");
  await writeFile(resolve(source, "agent-forum-dashboard.exe"), executable);
  await writeFile(resolve(source, "agent-forum-dashboard-cli.exe"), "helper\n");
  const archive = resolve(root, "dashboard.tar.gz");
  const tar = spawnSync("tar", ["-czf", archive, "-C", resolve(root, "source"), "agent-forum-dashboard"], { encoding: "utf8", shell: false });
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
    if (String(input).endsWith("manifest.json")) return Response.json(manifest);
    if (String(input) === manifest.assets[0]!.url) return new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } });
    return new Response("missing", { status: 404 });
  };
  return { root, fetcher: fetcher as typeof fetch };
}

test("Dashboard ensure asks once by default and managed policy completes future acquisition", async () => {
  const item = await dashboardFixture();
  const paths = createAgentForumPaths(resolve(item.root, "home"));
  try {
    const initial = await ensureDashboard({ platform: "win32", arch: "x64" }, paths);
    assert.equal(initial.status, "confirmation-required");
    assert.equal(initial.action, "install");
    assert.match(initial.acquisition?.browserUrl ?? "", /github\.com\/wszzs110\/agent-forum-skills\/releases(?:\/tag\/v[\d.]+)?$/u);
    assert.equal((await getDashboardAcquisitionPolicy(paths)).policy, "ask");

    await setDashboardAcquisitionPolicy("managed", paths);
    const ensured = await ensureDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }, paths);
    assert.equal(ensured.status, "ready");
    assert.equal(ensured.result?.action, "installed");

    const ready = await ensureDashboard({ platform: "win32", arch: "x64" }, paths);
    assert.equal(ready.status, "ready");
    assert.equal(ready.action, "none");

    await writeFile(ensured.result!.executable, "damaged dashboard");
    const repaired = await ensureDashboard({ manifestUrl: "http://127.0.0.1/manifest.json", platform: "win32", arch: "x64", fetcher: item.fetcher }, paths);
    assert.equal(repaired.status, "ready");
    assert.equal(repaired.action, "repair");
    assert.equal(repaired.result?.action, "updated");
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test("Dashboard ensure and policy expose stable CLI JSON contracts", async () => {
  const home = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-cli-policy-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    const stdout: string[] = [];
    assert.equal(await runCli(["--json", "dashboard", "ensure"], { stdout: (text) => stdout.push(text), stderr: () => undefined }), 0);
    const initial = JSON.parse(stdout.join(""));
    assert.equal(initial.ok, true);
    assert.equal(initial.command, "dashboard.ensure");
    assert.equal(initial.data.status, "confirmation-required");
    assert.equal(initial.data.policy, "ask");

    stdout.length = 0;
    assert.equal(await runCli(["--json", "dashboard", "policy", "--mode", "manual"], { stdout: (text) => stdout.push(text), stderr: () => undefined }), 0);
    const policy = JSON.parse(stdout.join(""));
    assert.equal(policy.ok, true);
    assert.equal(policy.data.policy, "manual");

    stdout.length = 0;
    assert.equal(await runCli(["--json", "dashboard", "ensure"], { stdout: (text) => stdout.push(text), stderr: () => undefined }), 0);
    const manual = JSON.parse(stdout.join(""));
    assert.equal(manual.data.status, "manual-required");
    assert.equal(manual.data.action, "import-local");
  } finally {
    process.env.HOME = previousHome;
    process.env.USERPROFILE = previousUserProfile;
    await rm(home, { recursive: true, force: true });
  }
});

test("Dashboard manual policy returns a local-import path without opening the network", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "agent-forum-dashboard-manual-"));
  const paths = createAgentForumPaths(root);
  try {
    await setDashboardAcquisitionPolicy("manual", paths);
    const result = await ensureDashboard({}, paths);
    assert.equal(result.status, "manual-required");
    assert.equal(result.action, "import-local");
    assert.match(result.acquisition?.browserUrl ?? "", /github\.com/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
