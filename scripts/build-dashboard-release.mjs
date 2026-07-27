import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { arch, platform } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const denoConfig = JSON.parse(await readFile(resolve(root, "dashboard", "deno.json"), "utf8"));
const dashboardVersion = denoConfig.version;
if (typeof dashboardVersion !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(dashboardVersion)) throw new Error("dashboard/deno.json must contain a valid Dashboard version");
// 纯 CLI/Skill 版本不应调用此 release 构建，避免以旧 Dashboard version 覆盖同名资产。
if (dashboardVersion !== packageJson.version) throw new Error(`Dashboard release build requires package version ${packageJson.version} to match dashboard version ${dashboardVersion}`);
const platformName = platform() === "win32" ? "win32" : platform() === "darwin" ? "darwin" : platform() === "linux" ? "linux" : undefined;
const archName = arch() === "x64" ? "x64" : arch() === "arm64" ? "arm64" : undefined;
if (!platformName || !archName) throw new Error(`Unsupported build host: ${platform()}-${arch()}`);
const userDeno = resolve(process.env.USERPROFILE ?? "", ".deno", "bin", "deno.exe");
const deno = process.env.DENO_BIN || (platformName === "win32" && existsSync(userDeno) ? userDeno : "deno");
const output = resolve(root, "dist", "dashboard", `${platformName}-${archName}`);
const staging = resolve(output, "payload");
const iconBuild = spawnSync(process.execPath, [resolve(root, "scripts", "generate-dashboard-icon.mjs")], { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" });
if (iconBuild.status !== 0) throw new Error(`Dashboard icon build failed with exit code ${iconBuild.status}`);
const skillBuild = spawnSync(process.execPath, [resolve(root, "scripts", "build-skill-bundle.mjs")], { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" });
if (skillBuild.status !== 0) throw new Error(`Skill bundle build failed with exit code ${skillBuild.status}`);
await rm(output, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
const bundleName = "agent-forum-dashboard";
const desktopOutput = resolve(staging, platformName === "darwin" ? `${bundleName}.app` : bundleName);
const icon = resolve(root, "dashboard", platformName === "win32" ? "icon.ico" : "icon.png");
const build = spawnSync(deno, ["desktop", "--icon", icon, "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net=127.0.0.1", "--allow-ffi", "--output", desktopOutput, resolve(root, "dashboard", "main.ts")], { cwd: resolve(root, "dashboard"), encoding: "utf8", shell: false, stdio: "inherit" });
if (build.error) throw new Error(`could not start deno desktop: ${build.error.message}`, { cause: build.error });
if (build.status !== 0) throw new Error(`deno desktop failed with ${build.signal ? `signal ${build.signal}` : `exit code ${build.status}`}`);
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
const configured = process.env.DASHBOARD_EXECUTABLE_RELATIVE;
const macExecutableDirectory = resolve(desktopOutput, "Contents", "MacOS");
const candidate = configured ? resolve(staging, configured) : files.find((path) =>
  platformName === "win32" ? basename(path) === `${bundleName}.exe` :
  platformName === "darwin" ? dirname(path) === macExecutableDirectory && !basename(path).endsWith(".dylib") :
  basename(path) === bundleName
);
if (!candidate) throw new Error("Deno Desktop did not produce a recognizable launcher; set DASHBOARD_EXECUTABLE_RELATIVE");
await stat(candidate);
const helperName = platformName === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli";
const helperArguments = ["compile", ...(platformName === "win32" ? ["--no-terminal"] : []), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "--allow-sys", "--output", resolve(dirname(candidate), helperName), resolve(root, "skills", "agent-forum", "scripts", "agent-forum.mjs")];
const helperBuild = spawnSync(deno, helperArguments, { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" });
if (helperBuild.error) throw new Error(`could not start Dashboard CLI helper build: ${helperBuild.error.message}`, { cause: helperBuild.error });
if (helperBuild.status !== 0) throw new Error(`Dashboard CLI helper build failed with ${helperBuild.signal ? `signal ${helperBuild.signal}` : `exit code ${helperBuild.status}`}`);
if (platformName === "darwin") {
  // macOS versioned frameworks rely on internal symlinks; resolving them creates an ambiguous, invalid bundle.
  const signed = spawnSync("codesign", ["--force", "--deep", "--sign", "-", desktopOutput], { encoding: "utf8", shell: false, stdio: "inherit" });
  if (signed.error) throw new Error(`could not start macOS codesign: ${signed.error.message}`, { cause: signed.error });
  if (signed.status !== 0) throw new Error(`Dashboard macOS ad-hoc signing failed with ${signed.signal ? `signal ${signed.signal}` : `exit code ${signed.status}`}`);
  const verified = spawnSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", desktopOutput], { encoding: "utf8", shell: false, stdio: "inherit" });
  if (verified.error) throw new Error(`could not verify macOS code signature: ${verified.error.message}`, { cause: verified.error });
  if (verified.status !== 0) throw new Error(`Dashboard macOS signature verification failed with ${verified.signal ? `signal ${verified.signal}` : `exit code ${verified.status}`}`);
}
const executablePath = candidate;
const executable = relative(staging, candidate).replaceAll("\\", "/");
const fileName = `agent-forum-dashboard-${dashboardVersion}-${platformName}-${archName}.tar.gz`;
const archive = resolve(output, fileName);
// 保留 macOS framework 的标准内部 symlink；安装器在解包前验证其目标与 entry 祖先。
const tar = spawnSync("tar", ["-czf", archive, "-C", staging, "."], { encoding: "utf8", shell: false });
if (tar.status !== 0) throw new Error(tar.stderr || `tar failed with exit code ${tar.status}`);
const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const information = await stat(archive);
const asset = {
  platform: platformName,
  arch: archName,
  fileName,
  archiveFormat: "tar.gz",
  executable: executable.replaceAll("\\", "/"),
  executableSha256: await hash(executablePath),
  url: `https://github.com/wszzs110/agent-forum-skills/releases/download/v${dashboardVersion}/${fileName}`,
  sha256: await hash(archive),
  size: information.size,
};
await writeFile(resolve(output, `${platformName}-${archName}.asset.json`), `${JSON.stringify(asset, null, 2)}\n`);
console.log(`Built ${archive}`);
