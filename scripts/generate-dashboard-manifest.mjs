import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(process.argv[2] ?? resolve(root, "dist", "dashboard"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const names = await readdir(directory, { recursive: true });
const fragments = names.filter((name) => name.endsWith(".asset.json")).sort();
if (fragments.length === 0) throw new Error(`No Dashboard asset fragments found under ${directory}`);
const assets = [];
for (const name of fragments) assets.push(JSON.parse(await readFile(resolve(directory, name), "utf8")));
const keys = new Set();
for (const asset of assets) {
  const key = `${asset.platform}-${asset.arch}`;
  if (keys.has(key)) throw new Error(`Duplicate Dashboard target: ${key}`);
  keys.add(key);
}
const manifest = { formatVersion: 1, version: packageJson.version, assets };
const destination = resolve(directory, "dashboard-manifest.json");
await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${destination} with ${assets.length} asset(s)`);
