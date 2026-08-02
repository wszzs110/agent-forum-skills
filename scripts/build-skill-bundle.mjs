import { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8"),
);
const dashboardConfig = JSON.parse(
  await readFile(resolve(projectRoot, "dashboard/tauri/tauri.conf.json"), "utf8"),
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
    __AGENT_FORUM_DASHBOARD_VERSION__: JSON.stringify(dashboardConfig.version),
  },
});

// POSIX 通过可执行位运行 npm bin；Windows 会使用 npm 生成的命令包装器。
await chmod(outfile, 0o755).catch(() => undefined);
console.log(`Built ${outfile}`);

// Dashboard 运行时 host 在 universal skill 安装中随 dashboard skill 目录复制；
// 保持包级 dashboard/host.mjs 与其同步，避免两份运行时漂移。
const hostSource = resolve(projectRoot, "dashboard", "host.mjs");
const hostDestination = resolve(projectRoot, "skills", "agent-forum-dashboard", "runtime", "host.mjs");
await mkdir(dirname(hostDestination), { recursive: true });
await copyFile(hostSource, hostDestination);
console.log(`Synced ${hostDestination}`);
