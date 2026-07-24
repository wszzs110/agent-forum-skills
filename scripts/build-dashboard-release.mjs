import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { arch, platform } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const denoConfig = JSON.parse(await readFile(resolve(root, "dashboard", "deno.json"), "utf8"));
if (denoConfig.version !== packageJson.version) throw new Error(`dashboard/deno.json version ${denoConfig.version} does not match package ${packageJson.version}`);
const platformName = platform() === "win32" ? "win32" : platform() === "darwin" ? "darwin" : platform() === "linux" ? "linux" : undefined;
const archName = arch() === "x64" ? "x64" : arch() === "arm64" ? "arm64" : undefined;
if (!platformName || !archName) throw new Error(`Unsupported build host: ${platform()}-${arch()}`);
const deno = process.env.DENO_BIN || (platformName === "win32" ? resolve(process.env.USERPROFILE ?? "", ".deno", "bin", "deno.exe") : "deno");
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
if (build.status !== 0) throw new Error(`deno desktop failed with exit code ${build.status}`);
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
const candidate = configured ? resolve(staging, configured) : files.find((path) =>
  platformName === "win32" ? basename(path) === `${bundleName}.exe` :
  platformName === "darwin" ? path.replaceAll("\\", "/").includes(".app/Contents/MacOS/") :
  basename(path) === bundleName
);
if (!candidate) throw new Error("Deno Desktop did not produce a recognizable launcher; set DASHBOARD_EXECUTABLE_RELATIVE");
await stat(candidate);
const helperName = platformName === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli";
const helperArguments = ["compile", ...(platformName === "win32" ? ["--no-terminal"] : []), "--allow-run", "--allow-env", "--allow-read", "--allow-write", "--allow-net", "--allow-sys", "--output", resolve(dirname(candidate), helperName), resolve(root, "skills", "agent-forum", "scripts", "agent-forum.mjs")];
const helperBuild = spawnSync(deno, helperArguments, { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" });
if (helperBuild.status !== 0) throw new Error(`Dashboard CLI helper build failed with exit code ${helperBuild.status}`);
async function materializeSymlinks(directory, root = directory) {
  const normalizedRoot = `${resolve(root)}/`;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const information = await lstat(path);
    if (information.isSymbolicLink()) {
      const target = await realpath(path);
      if (target !== resolve(root) && !target.replaceAll("\\", "/").startsWith(normalizedRoot.replaceAll("\\", "/"))) throw new Error(`Dashboard bundle symlink escapes staging: ${path}`);
      const targetInformation = await stat(target);
      await rm(path, { recursive: true, force: true });
      await cp(target, path, { recursive: targetInformation.isDirectory(), dereference: true });
    } else if (information.isDirectory()) await materializeSymlinks(path, root);
  }
}
if (platformName === "darwin") {
  // 先把 CEF framework 的 bundle 内链接物化，再签名最终文件树；安装包仍无需接受任意链接。
  await materializeSymlinks(desktopOutput);
  const signed = spawnSync("codesign", ["--force", "--deep", "--sign", "-", desktopOutput], { encoding: "utf8", shell: false, stdio: "inherit" });
  if (signed.status !== 0) throw new Error(`Dashboard macOS ad-hoc signing failed with exit code ${signed.status}`);
}
const executablePath = candidate;
const executable = relative(staging, candidate).replaceAll("\\", "/");
const fileName = `agent-forum-dashboard-${packageJson.version}-${platformName}-${archName}.tar.gz`;
const archive = resolve(output, fileName);
// 其他平台若出现可信 bundle 内链接也在归档时解引用，保持安装器拒绝任意链接的安全边界。
const tar = spawnSync("tar", ["-chzf", archive, "-C", staging, "."], { encoding: "utf8", shell: false });
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
  url: `https://github.com/wszzs110/agent-forum-skills/releases/download/v${packageJson.version}/${fileName}`,
  sha256: await hash(archive),
  size: information.size,
};
await writeFile(resolve(output, `${platformName}-${archName}.asset.json`), `${JSON.stringify(asset, null, 2)}\n`);
console.log(`Built ${archive}`);
