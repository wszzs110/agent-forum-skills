import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface CliEnvelope { ok: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } }

function bundledCli(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills", "agent-forum", "scripts", "agent-forum.mjs");
}

function executeCli(args: string[], cwd: string, onProgress?: (text: string) => void): Promise<CliEnvelope> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [bundledCli(), "--json", ...args], { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      onProgress?.(text);
    });
    child.on("error", reject);
    child.on("close", () => {
      try { resolveResult(JSON.parse(stdout) as CliEnvelope); }
      catch { reject(new Error(stderr.trim() || "agent-forum returned invalid JSON")); }
    });
  });
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
      // 用户显式输入 install/update 即构成一次性授权；不再要求重复输入 --yes。
      if (subcommand === "install" || subcommand === "update") {
        try {
          ctx.ui.setStatus("agent-forum-dashboard", `Dashboard ${subcommand}…`);
          const result = await executeCli(
            ["dashboard", "ensure", "--approve-once", ...(subcommand === "update" ? ["--update"] : [])],
            ctx.cwd,
            (text) => ctx.ui.setStatus("agent-forum-dashboard", text.trim() || `Dashboard ${subcommand}…`),
          );
          if (!result.ok) {
            ctx.ui.notify(result.error?.message ?? `Dashboard ${subcommand} failed.`, "error");
            return;
          }
          const data = result.data;
          if (data?.status === "manual-required") {
            const acquisition = data.acquisition as Record<string, unknown> | undefined;
            ctx.ui.notify(`Dashboard is configured for manual installation. Download: ${acquisition?.browserUrl ?? "GitHub Releases"}`, "info");
          } else {
            const completed = data?.result as Record<string, unknown> | undefined;
            ctx.ui.notify(`Dashboard ${completed?.action ?? "ready"}.`, "info");
          }
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : `Dashboard ${subcommand} failed.`, "error");
        } finally {
          ctx.ui.setStatus("agent-forum-dashboard", undefined);
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
        let ensured = await executeCli(["dashboard", "ensure"], ctx.cwd);
        if (!ensured.ok) {
          ctx.ui.notify(ensured.error?.message ?? "Unable to check Dashboard installation.", "error");
          return;
        }
        if (ensured.data?.status === "confirmation-required") {
          const acquisition = ensured.data.acquisition as Record<string, unknown> | undefined;
          const choice = await ctx.ui.select(
            `Install Dashboard ${acquisition?.version ?? ""}?`,
            ["Allow and remember", "Allow once", "Use manual download"],
          );
          if (!choice) return;
          if (choice === "Use manual download") {
            await executeCli(["dashboard", "policy", "--mode", "manual"], ctx.cwd);
            ctx.ui.notify(`Dashboard manual download: ${acquisition?.browserUrl ?? "GitHub Releases"}`, "info");
            return;
          }
          if (choice === "Allow and remember") {
            const policy = await executeCli(["dashboard", "policy", "--mode", "managed"], ctx.cwd);
            if (!policy.ok) {
              ctx.ui.notify(policy.error?.message ?? "Unable to save Dashboard policy.", "error");
              return;
            }
          }
          ctx.ui.setStatus("agent-forum-dashboard", "Downloading Dashboard…");
          ensured = await executeCli(["dashboard", "ensure", ...(choice === "Allow once" ? ["--approve-once"] : [])], ctx.cwd, (text) => ctx.ui.setStatus("agent-forum-dashboard", text.trim() || "Downloading Dashboard…"));
          ctx.ui.setStatus("agent-forum-dashboard", undefined);
        }
        if (!ensured.ok || ensured.data?.status !== "ready") {
          const acquisition = ensured.data?.acquisition as Record<string, unknown> | undefined;
          ctx.ui.notify(ensured.error?.message ?? `Dashboard requires manual installation: ${acquisition?.browserUrl ?? "GitHub Releases"}`, "error");
          return;
        }
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
