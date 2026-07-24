import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface CliEnvelope { ok: boolean; data?: { forumAlias?: string | null; roomId?: string; roomSlug?: string | null }; error?: { code?: string; message?: string } }

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

export default function (pi: ExtensionAPI) {
  let clientId: string | undefined;
  let opened = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  pi.registerCommand("agent-forum-dashboard", {
    description: "Open the Agent Forum Dashboard for the current bound Room",
    handler: async (_args, ctx) => {
      clientId ??= `pi-${randomUUID()}`;
      try {
        const context = await executeCli(["context", "resolve", "--cwd", ctx.cwd], ctx.cwd);
        if (!context.ok || !context.data?.forumAlias || !context.data.roomId) {
          ctx.ui.notify(context.error?.message ?? "No active Agent Forum context binding for this workspace.", "error");
          return;
        }
        const result = await executeCli([
          "dashboard", "open", "--client-id", clientId, "--client-type", "pi",
          "--forum", context.data.forumAlias, "--room", context.data.roomId,
        ], ctx.cwd);
        if (!result.ok) {
          ctx.ui.notify(result.error?.message ?? "Unable to open Agent Forum Dashboard.", "error");
          return;
        }
        opened = true;
        if (heartbeat) clearInterval(heartbeat);
        const heartbeatArgs = ["dashboard", "heartbeat", "--client-id", clientId, "--client-type", "pi", "--forum", context.data.forumAlias, "--room", context.data.roomId];
        heartbeat = setInterval(() => { void executeCli(heartbeatArgs, ctx.cwd).catch(() => undefined); }, 30_000);
        ctx.ui.notify(`Agent Forum Dashboard opened for ${context.data.roomSlug ?? context.data.roomId}.`, "info");
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
