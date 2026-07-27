import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputs = ["README.md", "README.zh-CN.md", "INSTALL.md", "CHANGELOG.md", "docs", "skills", "adapters"];
const files = [];
async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) await collect(child);
    else if ([".md", ".html"].includes(extname(entry.name))) files.push(child);
  }
}
for (const input of inputs) {
  const path = resolve(root, input);
  if (extname(path)) files.push(path); else await collect(path);
}

const errors = [];
for (const path of files.filter((file) => file.endsWith(".md"))) {
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const raw = match[1]?.trim().split(/\s+/u)[0];
    if (!raw || /^(?:https?:|mailto:|#)/u.test(raw)) continue;
    const target = decodeURIComponent(raw.split("#", 1)[0]);
    if (!target) continue;
    try { await access(resolve(dirname(path), target)); }
    catch { errors.push(`${path.slice(root.length + 1)}: missing link target ${raw}`); }
  }
}

const homePath = resolve(root, "docs", "index.html");
const home = await readFile(homePath, "utf8");
const ids = new Set([...home.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]));
for (const match of home.matchAll(/href="([^"]+)"/gu)) {
  const href = match[1];
  if (href.startsWith("#") && !ids.has(href.slice(1))) errors.push(`docs/index.html: missing anchor ${href}`);
  if (href.startsWith("./")) {
    try { await access(resolve(dirname(homePath), href)); }
    catch { errors.push(`docs/index.html: missing local target ${href}`); }
  }
}
if (new Set([...home.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1])).size !== [...home.matchAll(/\sid="([^"]+)"/gu)].length) errors.push("docs/index.html: duplicate id");

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const deno = JSON.parse(await readFile(resolve(root, "dashboard", "deno.json"), "utf8"));
const packageVersions = new Map([["package.json", packageJson.version], ["package-lock.json", packageLock.version]]);
for (const skill of ["agent-forum", "agent-forum-viewer", "agent-forum-dashboard"]) {
  const source = await readFile(resolve(root, "skills", skill, "SKILL.md"), "utf8");
  packageVersions.set(`skills/${skill}/SKILL.md`, source.match(/^\s*version:\s*["']?([^"'\s]+)["']?\s*$/mu)?.[1]);
}
for (const [path, version] of packageVersions) if (version !== packageJson.version) errors.push(`${path}: version ${version ?? "missing"} does not match ${packageJson.version}`);
if (typeof deno.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(deno.version)) errors.push("dashboard/deno.json: version must be a semantic version");

if (errors.length > 0) {
  for (const error of errors) console.error(`Error: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} documentation files, homepage anchors, local links, and release versions.`);
}
