import { chmod, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8"),
);
const outfile = resolve(
  projectRoot,
  "skills/agent-forum/scripts/agent-forum.mjs",
);

await mkdir(dirname(outfile), { recursive: true });
await build({
  entryPoints: [resolve(projectRoot, "src/main.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  legalComments: "none",
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __AGENT_FORUM_VERSION__: JSON.stringify(packageJson.version),
  },
});

// POSIX 通过可执行位运行 npm bin；Windows 会使用 npm 生成的命令包装器。
await chmod(outfile, 0o755).catch(() => undefined);
console.log(`Built ${outfile}`);
