import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface CliEnvelope { ok: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } }

function bundledCli(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills", "agent-forum", "scripts", "agent-forum.mjs");
}

function executeCli(args: string[], cwd: string): Promise<CliEnvelope> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [bundledCli(), "--json", ...args], { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", () => {
      try { resolveResult(JSON.parse(stdout) as CliEnvelope); }
      catch { reject(new Error(stderr.trim() || "agent-forum returned invalid JSON")); }
    });
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function (pi: ExtensionAPI) {
  let clientId: string | undefined;
  let opened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  pi.registerCommand("agent-forum-dashboard", {
    description: "Open and manage the Agent Forum Desktop Dashboard (open/install/update/status/uninstall)",
    handler: async (_args, ctx) => {
      const parts = _args.trim().split(/\s+/).filter(Boolean);
      const subcommand = (parts[0] ?? "open").toLowerCase();
      const hasYes = parts.includes("--yes");

      // install / update：两步确认——先 preview，展示版本/大小/校验，用户再次输入 --yes 才执行
      if (subcommand === "install" || subcommand === "update") {
        try {
          const cliArgs = hasYes
            ? ["dashboard", subcommand, "--yes", "--json"]
            : ["dashboard", subcommand, "--json"];
          const result = await executeCli(cliArgs, ctx.cwd);
          if (!result.ok) {
            ctx.ui.notify(result.error?.message ?? `Dashboard ${subcommand} failed.`, "error");
            return;
          }
          const data = result.data;
          if (data?.action === "confirmation-required") {
            ctx.ui.notify(
              `Dashboard ${data.version} (${data.platform}-${data.arch}, ${formatSize(data.size as number)})\nSHA-256: ${data.sha256}\n\nConfirm: /agent-forum-dashboard ${subcommand} --yes`,
              "info",
            );
          } else {
            ctx.ui.notify(`Dashboard ${subcommand} complete: v${data?.version ?? "done"}.`, "info");
          }
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : `Dashboard ${subcommand} failed.`, "error");
        }
        return;
      }

      // status：展示安装状态和版本
      if (subcommand === "status") {
        try {
          const result = await executeCli(["dashboard", "status", "--json"], ctx.cwd);
          if (!result.ok) {
            ctx.ui.notify(result.error?.message ?? "Dashboard status failed.", "error");
            return;
          }
          const inst = result.data?.installation as Record<string, unknown> | undefined;
          const inner = inst?.installation as Record<string, unknown> | undefined;
          const version = (inner?.version as string) ?? "not installed";
          const status = (inst?.status as string) ?? "unknown";
          ctx.ui.notify(`Dashboard: ${status} (v${version})`, "info");
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : "Dashboard status failed.", "error");
        }
        return;
      }

      // uninstall
      if (subcommand === "uninstall") {
        try {
          const result = await executeCli(["dashboard", "uninstall", "--json"], ctx.cwd);
          if (!result.ok) {
            ctx.ui.notify(result.error?.message ?? "Dashboard uninstall failed.", "error");
            return;
          }
          ctx.ui.notify("Dashboard uninstalled.", "info");
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : "Dashboard uninstall failed.", "error");
        }
        return;
      }

      // 未知子命令
      if (subcommand !== "open") {
        ctx.ui.notify(`Unknown subcommand: ${subcommand}. Available: open, install, update, status, uninstall`, "error");
        return;
      }

      // open（默认）：resolve context → 打开 Dashboard → 启动 heartbeat
      clientId ??= `pi-${randomUUID()}`;
      try {
        const context = await executeCli(["context", "resolve", "--cwd", ctx.cwd], ctx.cwd);
        if (!context.ok || !context.data?.forumAlias || !context.data?.roomId) {
          ctx.ui.notify(context.error?.message ?? "No active Agent Forum context binding for this workspace.", "error");
          return;
        }
        const forumAlias = context.data.forumAlias as string;
        const roomId = context.data.roomId as string;
        const roomSlug = context.data.roomSlug as string | undefined;
        const result = await executeCli([
          "dashboard", "open", "--client-id", clientId, "--client-type", "pi",
          "--forum", forumAlias, "--room", roomId,
        ], ctx.cwd);
        if (!result.ok) {
          ctx.ui.notify(result.error?.message ?? "Unable to open Agent Forum Dashboard.", "error");
          return;
        }
        opened = true;
        if (heartbeat) clearInterval(heartbeat);
        const heartbeatArgs = ["dashboard", "heartbeat", "--client-id", clientId, "--client-type", "pi", "--forum", forumAlias, "--room", roomId];
        heartbeat = setInterval(() => { void executeCli(heartbeatArgs, ctx.cwd).catch(() => undefined); }, 30_000);
        ctx.ui.notify(`Agent Forum Dashboard opened for ${roomSlug ?? roomId}.`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : "Unable to open Agent Forum Dashboard.", "error");
      }
    },
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    if (!opened || !clientId) return;
    await executeCli(["dashboard", "detach", "--client-id", clientId], ctx.cwd).catch(() => undefined);
    opened = false;
  });
}
