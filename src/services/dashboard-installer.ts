import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, mkdir, mkdtemp, open, readFile, readdir, readlink, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, posix, resolve, sep } from "node:path";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { DASHBOARD_VERSION } from "../version.js";
import { ServiceError } from "./errors.js";

const repository = "wszzs110/agent-forum-skills";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const fileNamePattern = /^[A-Za-z0-9._-]+$/u;
const executablePattern = /^[A-Za-z0-9._/-]+$/u;
const maximumAssetSize = 2 * 1024 * 1024 * 1024;
const assetConnectionTimeoutMs = 60_000;
const assetInactivityTimeoutMs = 10 * 60_000;

interface DashboardDownloadTimeouts {
  assetConnectionMs?: number;
  assetInactivityMs?: number;
}

export interface DashboardReleaseAsset {
  platform: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64";
  fileName: string;
  archiveFormat: "tar.gz";
  executable: string;
  executableSha256: string;
  url: string;
  sha256: string;
  size: number;
}

export interface DashboardReleaseManifest {
  formatVersion: 1;
  version: string;
  assets: DashboardReleaseAsset[];
}

export interface DashboardInstallation {
  formatVersion: 1;
  version: string;
  platform: DashboardReleaseAsset["platform"];
  arch: DashboardReleaseAsset["arch"];
  executable: string;
  executableSha256: string;
  files: Record<string, string>;
  sourceUrl: string;
  installedAt: string;
}

export interface DashboardInstallationStatus {
  status: "not-installed" | "installed" | "modified" | "damaged";
  installation?: DashboardInstallation;
  executable?: string;
  /** 相对安装根目录的缺失、替换或意外文件；仅用于本机诊断。 */
  modifiedFiles?: string[];
}

function defaultManifestUrl(dashboardVersion = DASHBOARD_VERSION): string {
  if (dashboardVersion === "0.0.0-dev") {
    throw new ServiceError("DASHBOARD_RELEASE_UNAVAILABLE", "development builds require --manifest-url or AGENT_FORUM_DASHBOARD_MANIFEST_URL");
  }
  return `https://github.com/${repository}/releases/download/v${dashboardVersion}/dashboard-manifest.json`;
}

function safeExecutable(root: string, relative: string): string {
  if (!executablePattern.test(relative) || relative.startsWith("/") || relative.includes("..") || relative.includes("\\")) {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `unsafe Dashboard executable path: ${relative}`);
  }
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, relative);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard executable escapes its installation directory");
  return target;
}

function parseManifest(value: unknown): DashboardReleaseManifest {
  if (!value || typeof value !== "object") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest must be an object");
  const manifest = value as Record<string, unknown>;
  const topLevelKeys = Object.keys(manifest).sort();
  if (topLevelKeys.length !== 3 || topLevelKeys[0] !== "assets" || topLevelKeys[1] !== "formatVersion" || topLevelKeys[2] !== "version") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest contains missing or unknown fields");
  if (manifest.formatVersion !== 1 || typeof manifest.version !== "string" || !versionPattern.test(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest has invalid top-level fields");
  }
  const assets: DashboardReleaseAsset[] = manifest.assets.map((unknownAsset) => {
    if (!unknownAsset || typeof unknownAsset !== "object") throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset must be an object");
    const asset = unknownAsset as Record<string, unknown>;
    const keys = Object.keys(asset).sort();
    const expected = ["arch", "archiveFormat", "executable", "executableSha256", "fileName", "platform", "sha256", "size", "url"].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset contains missing or unknown fields");
    if ((asset.platform !== "win32" && asset.platform !== "darwin" && asset.platform !== "linux") || (asset.arch !== "x64" && asset.arch !== "arm64") || asset.archiveFormat !== "tar.gz" || typeof asset.fileName !== "string" || !fileNamePattern.test(asset.fileName) || typeof asset.executable !== "string" || typeof asset.executableSha256 !== "string" || !sha256Pattern.test(asset.executableSha256) || typeof asset.sha256 !== "string" || !sha256Pattern.test(asset.sha256) || !Number.isSafeInteger(asset.size) || Number(asset.size) <= 0 || Number(asset.size) > maximumAssetSize || typeof asset.url !== "string") {
      throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset contains invalid fields");
    }
    safeExecutable("/dashboard", asset.executable);
    let url: URL;
    try { url = new URL(asset.url); } catch { throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset URL is invalid"); }
    if (url.protocol !== "https:" || url.username || url.password) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release asset URL must use credential-free HTTPS");
    return asset as unknown as DashboardReleaseAsset;
  });
  const targets = new Set<string>();
  for (const asset of assets) {
    const target = `${asset.platform}-${asset.arch}`;
    if (targets.has(target)) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `duplicate Dashboard release target: ${target}`);
    targets.add(target);
  }
  return { formatVersion: 1, version: manifest.version, assets };
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  // FileHandle.readableWebStream() 与显式 close() 在 Node 20.20.2 中可能重复关闭同一句柄并触发原生断言。
  // createReadStream() 独占并自动关闭自己的文件描述符，可避免跨平台的双重关闭竞态。
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function collectInstalledFiles(root: string, directory = root): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const lexicalRoot = resolve(root);
  const canonicalRoot = await realpath(root);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === root && entry.name === "installation.json") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await collectInstalledFiles(root, path));
    else if (entry.isFile()) files[relativePath(root, path)] = await sha256File(path);
    else if (entry.isSymbolicLink()) {
      const target = await readlink(path);
      if (!target || isAbsolute(target) || target.includes("\\") || target.includes("\0")) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation contains an unsafe symbolic link");
      const lexicalTarget = resolve(dirname(path), target);
      if (lexicalTarget !== lexicalRoot && !lexicalTarget.startsWith(`${lexicalRoot}${sep}`)) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation symbolic link escapes its root");
      const canonicalTarget = await realpath(path);
      if (canonicalTarget !== canonicalRoot && !canonicalTarget.startsWith(`${canonicalRoot}${sep}`)) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation symbolic link resolves outside its root");
      files[relativePath(root, path)] = createHash("sha256").update(`symlink:${target}`).digest("hex");
    } else throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation contains an unsupported filesystem entry");
  }
  return files;
}

function relativePath(root: string, path: string): string {
  return path.slice(resolve(root).length + 1).split(sep).join("/");
}

function modifiedFilePaths(expected: Record<string, string>, actual: Record<string, string>): string[] {
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter((path) => expected[path] !== actual[path])
    .sort();
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", `Dashboard release manifest returned HTTP ${response.status}`);
      try { return await response.json(); } catch { throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard release manifest is not valid JSON"); }
    } catch (error) {
      if (error instanceof ServiceError && error.code === "DASHBOARD_MANIFEST_INVALID") throw error;
      lastError = error;
      if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 200));
    }
  }
  throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "could not download Dashboard release manifest", { cause: lastError instanceof Error ? lastError.message : String(lastError) });
}

export function dashboardReleasePageUrl(dashboardVersion = DASHBOARD_VERSION): string {
  if (dashboardVersion === "0.0.0-dev") return `https://github.com/${repository}/releases`;
  return `https://github.com/${repository}/releases/tag/v${dashboardVersion}`;
}

export async function inspectDashboardRelease(options: { manifestUrl?: string; platform?: NodeJS.Platform; arch?: string; fetcher?: typeof fetch; dashboardVersion?: string; packageVersion?: string } = {}): Promise<{ manifestUrl: string; version: string; asset: DashboardReleaseAsset }> {
  // packageVersion is retained as a test-only backward-compatible alias for dashboardVersion.
  const dashboardVersion = options.dashboardVersion ?? options.packageVersion ?? DASHBOARD_VERSION;
  const configuredManifestUrl = options.manifestUrl ?? process.env.AGENT_FORUM_DASHBOARD_MANIFEST_URL;
  const manifestUrl = configuredManifestUrl ?? defaultManifestUrl(dashboardVersion);
  let parsedUrl: URL;
  try { parsedUrl = new URL(manifestUrl); } catch { throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard manifest URL is invalid"); }
  if ((parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") || parsedUrl.username || parsedUrl.password) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "Dashboard manifest URL must use credential-free HTTPS");
  const manifest = parseManifest(await fetchJson(manifestUrl, options.fetcher ?? fetch));
  if (!configuredManifestUrl && dashboardVersion !== "0.0.0-dev" && manifest.version !== dashboardVersion) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", `Dashboard manifest version ${manifest.version} does not match the required Dashboard version ${dashboardVersion}`);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const asset = manifest.assets.find((candidate) => candidate.platform === platform && candidate.arch === arch);
  if (!asset) throw new ServiceError("DASHBOARD_PLATFORM_UNSUPPORTED", `no Dashboard release for ${platform}-${arch}`);
  return { manifestUrl, version: manifest.version, asset };
}

/** 本地 archive 导入使用同一严格 manifest 解析与目标选择，完全不访问网络。 */
export async function inspectDashboardReleaseFile(manifestPath: string, options: { platform?: NodeJS.Platform; arch?: string } = {}): Promise<{ manifestUrl: string; version: string; asset: DashboardReleaseAsset }> {
  let value: unknown;
  try { value = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch (error) { throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "could not read Dashboard release manifest file", { cause: error instanceof Error ? error.message : String(error) }); }
  const manifest = parseManifest(value);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const asset = manifest.assets.find((candidate) => candidate.platform === platform && candidate.arch === arch);
  if (!asset) throw new ServiceError("DASHBOARD_PLATFORM_UNSUPPORTED", `no Dashboard release for ${platform}-${arch}`);
  return { manifestUrl: `file://${resolve(manifestPath)}`, version: manifest.version, asset };
}

async function existingPartialSize(asset: DashboardReleaseAsset, destination: string): Promise<number> {
  try {
    const existing = await stat(destination);
    if (!existing.isFile() || existing.size > asset.size) {
      await rm(destination, { force: true });
      return 0;
    }
    if (existing.size === asset.size) {
      if (await sha256File(destination) === asset.sha256) return asset.size;
      await rm(destination, { force: true });
      return 0;
    }
    return existing.size;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
}

async function appendExistingBytes(hash: ReturnType<typeof createHash>, destination: string): Promise<void> {
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
}

/**
 * 下载缓存保留为 .part；外层进程被终止后，下次会通过 Range 从已验证字节继续。
 * 服务器忽略 Range 并返回 200 时安全地从头重下，而不会拼接出损坏 archive。
 */
async function downloadAssetOnce(asset: DashboardReleaseAsset, destination: string, fetcher: typeof fetch, onProgress?: (received: number, total: number, attempt: number) => void, attempt = 1, timeouts: DashboardDownloadTimeouts = {}): Promise<void> {
  let offset = await existingPartialSize(asset, destination);
  if (offset === asset.size) {
    onProgress?.(asset.size, asset.size, attempt);
    return;
  }
  const controller = new AbortController();
  const connectionTimeout = timeouts.assetConnectionMs ?? assetConnectionTimeoutMs;
  const inactivityTimeout = timeouts.assetInactivityMs ?? assetInactivityTimeoutMs;
  let timedOut = false;
  let connectionTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, connectionTimeout);
  let response: Response;
  try {
    response = await fetcher(asset.url, {
      redirect: "follow",
      signal: controller.signal,
      ...(offset > 0 ? { headers: { Range: `bytes=${offset}-` } } : {}),
    });
  } catch (error) {
    throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", timedOut ? "Dashboard release asset connection timed out" : "could not download Dashboard release asset", { cause: error instanceof Error ? error.message : String(error) });
  } finally {
    if (connectionTimer) clearTimeout(connectionTimer);
    connectionTimer = undefined;
  }
  if (!response.ok || !response.body) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", `Dashboard release asset returned HTTP ${response.status}`);
  const resuming = offset > 0 && response.status === 206;
  if (!resuming) {
    offset = 0;
    await rm(destination, { force: true });
  }
  const declared = response.headers.get("content-length");
  const expectedLength = asset.size - offset;
  if (declared && Number(declared) !== expectedLength) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset size does not match the manifest");
  const handle = await open(destination, resuming ? "a" : "w", 0o600);
  const hash = createHash("sha256");
  if (resuming) await appendExistingBytes(hash, destination);
  let received = offset;
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, inactivityTimeout);
  };
  const reader = response.body.getReader();
  try {
    resetInactivityTimer();
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      resetInactivityTimer();
      received += result.value.byteLength;
      if (received > asset.size) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset exceeds the declared size");
      hash.update(result.value);
      await handle.write(result.value);
      onProgress?.(received, asset.size, attempt);
    }
    await handle.sync();
  } catch (error) {
    if (timedOut) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset download stalled", { cause: error instanceof Error ? error.message : String(error) });
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "could not download Dashboard release asset", { cause: error instanceof Error ? error.message : String(error) });
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    await reader.cancel().catch(() => undefined);
    await handle.close().catch(() => undefined);
  }
  if (received !== asset.size) throw new ServiceError("DASHBOARD_DOWNLOAD_FAILED", "Dashboard release asset is incomplete");
  if (hash.digest("hex") !== asset.sha256) {
    await rm(destination, { force: true });
    throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard release asset failed SHA-256 verification");
  }
}

async function downloadAsset(asset: DashboardReleaseAsset, destination: string, fetcher: typeof fetch, onProgress?: (received: number, total: number, attempt: number) => void, timeouts: DashboardDownloadTimeouts = {}): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { await downloadAssetOnce(asset, destination, fetcher, onProgress, attempt, timeouts); return; }
    catch (error) {
      lastError = error;
      if (error instanceof ServiceError && error.code === "DASHBOARD_CHECKSUM_MISMATCH") throw error;
      if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 200));
    }
  }
  throw lastError;
}

async function runTar(args: string[]): Promise<string> {
  return new Promise<string>((resolveTar, reject) => {
    const child = spawn("tar", args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => reject(new ServiceError("DASHBOARD_INSTALL_FAILED", "could not start the system tar extractor", { cause: error.message })));
    child.on("close", (code) => code === 0 ? resolveTar(stdout) : reject(new ServiceError("DASHBOARD_INSTALL_FAILED", "could not inspect or extract the Dashboard release asset", { cause: stderr.trim() })));
  });
}

function normalizedArchivePath(entry: string): string {
  const trimmed = entry.replace(/^\.\//u, "").replace(/\/$/u, "");
  return trimmed || ".";
}

export function validateDashboardArchiveEntries(entries: string[], verboseEntries: string[]): void {
  if (entries.length === 0 || verboseEntries.length !== entries.length) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive listing is incomplete");
  const normalizedEntries = entries.map(normalizedArchivePath);
  const uniqueEntries = new Set<string>();
  const symlinkEntries = new Set<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const normalized = normalizedEntries[index]!;
    const verbose = verboseEntries[index]!;
    if (entry.startsWith("/") || entry.startsWith("\\") || entry.includes("\\") || entry.split("/").includes("..") || uniqueEntries.has(normalized)) {
      throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsafe or duplicate path");
    }
    uniqueEntries.add(normalized);
    const type = verbose[0];
    if (type === "-" || type === "d") continue;
    if (type !== "l") throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsupported link type");
    const separator = verbose.lastIndexOf(" -> ");
    const target = separator >= 0 ? verbose.slice(separator + 4) : "";
    if (!target || posix.isAbsolute(target) || target.includes("\\") || target.includes("\0")) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive contains an unsafe symbolic link");
    const resolvedTarget = posix.normalize(posix.join(posix.dirname(normalized), target));
    if (resolvedTarget === ".." || resolvedTarget.startsWith("../")) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive symbolic link escapes its root");
    symlinkEntries.add(normalized);
  }
  for (const entry of normalizedEntries) {
    let ancestor = posix.dirname(entry);
    while (ancestor !== ".") {
      if (symlinkEntries.has(ancestor)) throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release archive writes through a symbolic link");
      ancestor = posix.dirname(ancestor);
    }
  }
}

async function extractArchive(archive: string, destination: string): Promise<void> {
  const entries = (await runTar(["-tzf", archive])).split(/\r?\n/u).filter(Boolean);
  const verboseEntries = (await runTar(["-tvzf", archive])).split(/\r?\n/u).filter(Boolean);
  validateDashboardArchiveEntries(entries, verboseEntries);
  await mkdir(destination, { recursive: true });
  await runTar(["-xzf", archive, "-C", destination]);
}

export async function getDashboardInstallationStatus(paths = createAgentForumPaths()): Promise<DashboardInstallationStatus> {
  let installation: DashboardInstallation;
  try { installation = JSON.parse(await readFile(paths.dashboardInstallationFile, "utf8")) as DashboardInstallation; }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { status: "not-installed" };
    return { status: "damaged" };
  }
  if (installation.formatVersion !== 1 || !versionPattern.test(installation.version) || !sha256Pattern.test(installation.executableSha256) || !installation.files || typeof installation.files !== "object" || Object.values(installation.files).some((hash) => !sha256Pattern.test(hash))) return { status: "damaged" };
  let executable: string;
  try { executable = safeExecutable(paths.dashboardInstallDirectory, installation.executable); await stat(executable); }
  catch { return { status: "damaged", installation }; }
  try {
    const actual = await sha256File(executable);
    const files = await collectInstalledFiles(paths.dashboardInstallDirectory);
    const modifiedFiles = modifiedFilePaths(installation.files, files);
    return actual === installation.executableSha256 && modifiedFiles.length === 0
      ? { status: "installed", installation, executable }
      : { status: "modified", installation, executable, modifiedFiles };
  } catch { return { status: "damaged", installation, executable }; }
}

export interface InstallDashboardOptions {
  manifestUrl?: string;
  /** Browser-downloaded manifest; with archivePath this path is fully offline. */
  manifestPath?: string;
  /** Browser-downloaded archive to verify and import instead of downloading. */
  archivePath?: string;
  update?: boolean;
  force?: boolean;
  now?: Date;
  fetcher?: typeof fetch;
  platform?: NodeJS.Platform;
  arch?: string;
  onProgress?: (received: number, total: number, attempt: number) => void;
  downloadTimeouts?: DashboardDownloadTimeouts;
}

async function resolveDashboardRelease(options: InstallDashboardOptions): Promise<{ manifestUrl: string; version: string; asset: DashboardReleaseAsset }> {
  if (options.manifestPath) {
    if (options.manifestUrl) throw new ServiceError("DASHBOARD_MANIFEST_INVALID", "--manifest and --manifest-url cannot be used together");
    return inspectDashboardReleaseFile(options.manifestPath, options);
  }
  return inspectDashboardRelease(options);
}

async function verifyArchive(asset: DashboardReleaseAsset, archive: string): Promise<void> {
  let archiveStat;
  try { archiveStat = await stat(archive); }
  catch (error) { throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard archive file does not exist", { cause: error instanceof Error ? error.message : String(error) }); }
  if (!archiveStat.isFile() || archiveStat.size !== asset.size) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard archive size does not match the manifest");
  if (await sha256File(archive) !== asset.sha256) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "Dashboard archive failed SHA-256 verification");
}

async function acquireArchive(release: { version: string; asset: DashboardReleaseAsset }, options: InstallDashboardOptions, paths: AgentForumPaths): Promise<string> {
  if (options.archivePath) {
    await verifyArchive(release.asset, options.archivePath);
    return options.archivePath;
  }
  const cacheName = `${release.version}-${release.asset.platform}-${release.asset.arch}-${release.asset.fileName}.part`;
  const archive = resolve(paths.dashboardDownloadsDirectory, cacheName);
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, `dashboard-download-${release.version}-${release.asset.platform}-${release.asset.arch}.lock`),
    command: "dashboard download",
  });
  try {
    await mkdir(paths.dashboardDownloadsDirectory, { recursive: true, mode: 0o700 });
    await downloadAsset(release.asset, archive, options.fetcher ?? fetch, options.onProgress, options.downloadTimeouts);
    return archive;
  } finally {
    await lock.release();
  }
}

/** 下载、校验和解压不持有安装激活锁；只有最终替换安装目录的瞬间串行化。 */
export async function installDashboard(options: InstallDashboardOptions = {}, paths = createAgentForumPaths()): Promise<{ action: "installed" | "updated" | "unchanged"; installation: DashboardInstallation; executable: string }> {
  const release = await resolveDashboardRelease(options);
  const before = await getDashboardInstallationStatus(paths);
  if (before.status === "installed" && before.installation?.version === release.version) return { action: "unchanged", installation: before.installation, executable: before.executable! };
  if (before.status !== "not-installed" && !options.update) throw new ServiceError("DASHBOARD_ALREADY_INSTALLED", "Dashboard is already installed; use dashboard update");
  if ((before.status === "modified" || before.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat update with --force");
  const archive = await acquireArchive(release, options, paths);
  await mkdir(dirname(paths.dashboardInstallDirectory), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(paths.dashboardInstallDirectory), ".dashboard-install-"));
  const payload = resolve(staging, "payload");
  try {
    await extractArchive(archive, payload);
    const stagedExecutable = safeExecutable(payload, release.asset.executable);
    await stat(stagedExecutable);
    if (await sha256File(stagedExecutable) !== release.asset.executableSha256) throw new ServiceError("DASHBOARD_CHECKSUM_MISMATCH", "extracted Dashboard executable failed SHA-256 verification");
    const stagedHelper = resolve(dirname(stagedExecutable), release.asset.platform === "win32" ? "agent-forum-dashboard-cli.exe" : "agent-forum-dashboard-cli");
    try { await stat(stagedHelper); }
    catch { throw new ServiceError("DASHBOARD_INSTALL_FAILED", "Dashboard release does not contain its CLI helper"); }
    if (process.platform !== "win32") { await chmod(stagedExecutable, 0o700); await chmod(stagedHelper, 0o700); }
    const files = await collectInstalledFiles(payload);
    const installation: DashboardInstallation = { formatVersion: 1, version: release.version, platform: release.asset.platform, arch: release.asset.arch, executable: release.asset.executable, executableSha256: release.asset.executableSha256, files, sourceUrl: release.asset.url, installedAt: (options.now ?? new Date()).toISOString() };
    await writeJsonAtomic(resolve(payload, "installation.json"), installation, { overwrite: true });
    const lock = await acquireForumLock({ lockPath: resolve(paths.locksDirectory, "dashboard-install.lock"), command: "dashboard activate" });
    try {
      const current = await getDashboardInstallationStatus(paths);
      if (current.status === "installed" && current.installation?.version === release.version) return { action: "unchanged", installation: current.installation, executable: current.executable! };
      if (current.status !== "not-installed" && !options.update) throw new ServiceError("DASHBOARD_ALREADY_INSTALLED", "Dashboard is already installed; use dashboard update");
      if ((current.status === "modified" || current.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat update with --force");
      const backup = resolve(dirname(paths.dashboardInstallDirectory), `.dashboard-backup-${Date.now()}`);
      let backedUp = false;
      try {
        if (current.status !== "not-installed") { await rename(paths.dashboardInstallDirectory, backup); backedUp = true; }
        await rename(payload, paths.dashboardInstallDirectory);
        if (backedUp) await rm(backup, { recursive: true, force: true });
      } catch (error) {
        if (backedUp) await rename(backup, paths.dashboardInstallDirectory).catch(() => undefined);
        throw error;
      }
      return { action: current.status === "not-installed" ? "installed" : "updated", installation, executable: safeExecutable(paths.dashboardInstallDirectory, installation.executable) };
    } finally {
      await lock.release();
    }
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function uninstallDashboard(options: { force?: boolean } = {}, paths = createAgentForumPaths()): Promise<{ action: "uninstalled" | "not-installed" }> {
  const lock = await acquireForumLock({ lockPath: resolve(paths.locksDirectory, "dashboard-install.lock"), command: "dashboard uninstall" });
  try {
    const status = await getDashboardInstallationStatus(paths);
    if (status.status === "not-installed") return { action: "not-installed" };
    if ((status.status === "modified" || status.status === "damaged") && !options.force) throw new ServiceError("DASHBOARD_INSTALLATION_MODIFIED", "Dashboard installation is modified or damaged; inspect it and repeat uninstall with --force");
    await rm(paths.dashboardInstallDirectory, { recursive: true, force: true });
    return { action: "uninstalled" };
  } finally { await lock.release(); }
}
