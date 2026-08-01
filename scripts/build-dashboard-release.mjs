import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const tauriConfig = JSON.parse(await readFile(resolve(root, "dashboard", "tauri", "tauri.conf.json"), "utf8"));
const dashboardVersion = tauriConfig.version;
if (typeof dashboardVersion !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(dashboardVersion)) throw new Error("dashboard/tauri/tauri.conf.json must contain a valid Dashboard version");
if (dashboardVersion !== packageJson.version) throw new Error(`Dashboard release build requires package version ${packageJson.version} to match dashboard version ${dashboardVersion}`);
const platformName = platform() === "win32" ? "win32" : platform() === "darwin" ? "darwin" : platform() === "linux" ? "linux" : undefined;
const archName = arch() === "x64" ? "x64" : arch() === "arm64" ? "arm64" : undefined;
if (!platformName || !archName) throw new Error(`Unsupported build host: ${platform()}-${arch()}`);
const output = resolve(root, "dist", "dashboard", `${platformName}-${archName}`);
const staging = resolve(output, "payload");
const targetDirectory = resolve(output, "cargo-target");
const bundleName = "agent-forum-dashboard";
const executableName = platformName === "win32" ? `${bundleName}.exe` : bundleName;
const iconBuild = spawnSync(process.execPath, [resolve(root, "scripts", "generate-dashboard-icon.mjs")], { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" });
if (iconBuild.status !== 0) throw new Error(`Dashboard icon build failed with exit code ${iconBuild.status}`);
await rm(output, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
const rustTarget = process.env.AGENT_FORUM_DASHBOARD_RUST_TARGET;
const build = spawnSync("cargo", ["build", "--release", "--manifest-path", resolve(root, "dashboard", "tauri", "Cargo.toml"), ...(rustTarget ? ["--target", rustTarget] : [])], {
  cwd: root,
  encoding: "utf8",
  shell: false,
  stdio: "inherit",
  env: { ...process.env, CARGO_TARGET_DIR: targetDirectory },
});
if (build.error) throw new Error(`could not start cargo: ${build.error.message}`, { cause: build.error });
if (build.status !== 0) throw new Error(`cargo build failed with ${build.signal ? `signal ${build.signal}` : `exit code ${build.status}`}`);
const builtExecutable = resolve(targetDirectory, ...(rustTarget ? [rustTarget] : []), "release", executableName);
const executable = resolve(staging, executableName);
await stat(builtExecutable);
await writeFile(executable, await readFile(builtExecutable), { mode: 0o700 });

/** Windows GNU 本机构建动态依赖 WebView2Loader；统一携带官方 crate 提供的极小 loader，避免构建目标差异破坏安装后启动。 */
async function copyWebView2Loader() {
  if (platformName !== "win32") return;
  const cargoHome = process.env.CARGO_HOME ?? resolve(homedir(), ".cargo");
  const registrySource = resolve(cargoHome, "registry", "src");
  const target = archName === "x64" ? "x64" : "arm64";
  const registries = await readdir(registrySource, { withFileTypes: true });
  for (const registry of registries) {
    if (!registry.isDirectory()) continue;
    const crates = await readdir(resolve(registrySource, registry.name), { withFileTypes: true });
    const source = crates.find((crate) => crate.isDirectory() && /^webview2-com-sys-\d/u.test(crate.name));
    if (!source) continue;
    const loader = resolve(registrySource, registry.name, source.name, target, "WebView2Loader.dll");
    try {
      await writeFile(resolve(staging, "WebView2Loader.dll"), await readFile(loader), { mode: 0o700 });
      return;
    } catch {
      // 继续搜索其他 registry；最终会给出可操作的构建错误。
    }
  }
  throw new Error("could not locate WebView2Loader.dll from the locked WebView2 crate");
}
await copyWebView2Loader();

/** 递归读取 staging 文件，用于阻止 CEF、Deno 与内置 CLI helper 回归到 release archive。 */
async function findFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findFiles(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

const files = await findFiles(staging);
const prohibited = files.find((path) => /(?:libcef|chrome_elf|snapshot_blob|v8_context_snapshot|agent-forum-dashboard-cli|deno)/iu.test(basename(path)));
if (prohibited) throw new Error(`Dashboard archive must not contain a CEF, Deno, or embedded CLI payload: ${relative(staging, prohibited)}`);
const fileName = `agent-forum-dashboard-${dashboardVersion}-${platformName}-${archName}.tar.gz`;
const archive = resolve(output, fileName);
const tar = spawnSync("tar", ["-czf", archive, "-C", staging, "."], { encoding: "utf8", shell: false });
if (tar.status !== 0) throw new Error(tar.stderr || `tar failed with exit code ${tar.status}`);
const maximumArchiveSize = 30 * 1024 * 1024;
const archiveStat = await stat(archive);
if (archiveStat.size > maximumArchiveSize) throw new Error(`Dashboard archive exceeds the ${maximumArchiveSize / 1024 / 1024} MiB budget: ${archiveStat.size} bytes`);
const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const asset = {
  platform: platformName,
  arch: archName,
  fileName,
  archiveFormat: "tar.gz",
  executable: relative(staging, executable).replaceAll("\\", "/"),
  executableSha256: await hash(executable),
  url: `https://github.com/wszzs110/agent-forum-skills/releases/download/v${dashboardVersion}/${fileName}`,
  sha256: await hash(archive),
  size: archiveStat.size,
};
await writeFile(resolve(output, `${platformName}-${archName}.asset.json`), `${JSON.stringify(asset, null, 2)}\n`);
console.log(`Built ${archive} (${archiveStat.size} bytes)`);
