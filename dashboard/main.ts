// Deno Desktop 的窄条 Dashboard：协议、同步和统计均委托给 agent-forum CLI。
const cli = Deno.env.get("AGENT_FORUM_CLI") ?? "agent-forum";
const cliScript = Deno.env.get("AGENT_FORUM_CLI_SCRIPT");
const home = Deno.env.get(Deno.build.os === "windows" ? "USERPROFILE" : "HOME");
if (!home) throw new Error("Dashboard cannot resolve the user home directory");
const stateDirectory = `${home}/.AgentForum/state/dashboard`;
const desktopFile = `${stateDirectory}/desktop.json`;
const lockFile = `${stateDirectory}/desktop.lock`;
const token = crypto.randomUUID();

function wide(value: string): Uint16Array { const buffer = new Uint16Array(value.length + 1); for (let index = 0; index < value.length; index += 1) buffer[index] = value.charCodeAt(index); return buffer; }
function setWindowsTaskbarIdentity(): void {
  if (Deno.build.os !== "windows") return;
  try {
    const shell32 = Deno.dlopen("shell32.dll", { SetCurrentProcessExplicitAppUserModelID: { parameters: ["buffer"], result: "i32" } });
    shell32.symbols.SetCurrentProcessExplicitAppUserModelID(wide("dev.agent-forum.dashboard"));
    shell32.close();
  } catch { /* FFI is best-effort on unsupported desktop builds. */ }
}
function configureWindowsWindow(): void {
  if (Deno.build.os !== "windows") return;
  const iconPath = Deno.env.get("AGENT_FORUM_DASHBOARD_ICON");
  try {
    const user32 = Deno.dlopen("user32.dll", {
      FindWindowW: { parameters: ["buffer", "buffer"], result: "pointer" },
      LoadImageW: { parameters: ["pointer", "buffer", "u32", "i32", "i32", "u32"], result: "pointer" },
      SendMessageW: { parameters: ["usize", "u32", "usize", "usize"], result: "usize" },
      GetWindowLongW: { parameters: ["pointer", "i32"], result: "i32" },
      SetWindowLongW: { parameters: ["pointer", "i32", "i32"], result: "i32" },
      SetWindowPos: { parameters: ["pointer", "pointer", "i32", "i32", "i32", "i32", "u32"], result: "i32" },
    });
    const window = user32.symbols.FindWindowW(null, wide("Agent Forum Dashboard"));
    if (window) {
      // CEF 可能忽略 BrowserWindow 的 resizable:false；移除 Win32 size/maximize 样式作尽力限制，但不在拖动期间强制抢回尺寸。
      const style = user32.symbols.GetWindowLongW(window, -16);
      user32.symbols.SetWindowLongW(window, -16, style & ~(0x00040000 | 0x00010000));
      user32.symbols.SetWindowPos(window, null, 0, 0, 0, 0, 0x0027);
      if (iconPath) {
        const icon = user32.symbols.LoadImageW(null, wide(iconPath), 1, 32, 32, 0x10 | 0x40);
        if (icon) {
          const windowHandle = Deno.UnsafePointer.value(window);
          const iconHandle = Deno.UnsafePointer.value(icon);
          user32.symbols.SendMessageW(windowHandle, 0x80, 1n, iconHandle);
          user32.symbols.SendMessageW(windowHandle, 0x80, 0n, iconHandle);
        }
      }
    }
    user32.close();
  } catch { /* Windows window APIs are best-effort on unsupported desktop builds. */ }
}
setWindowsTaskbarIdentity();

interface ClientInput { clientId: string; clientType: string; forumAlias: string; roomId: string; identityId?: string }
const initialClient: ClientInput = {
  clientId: Deno.env.get("AGENT_FORUM_DASHBOARD_CLIENT_ID") ?? "",
  clientType: Deno.env.get("AGENT_FORUM_DASHBOARD_CLIENT_TYPE") ?? "",
  forumAlias: Deno.env.get("AGENT_FORUM_DASHBOARD_FORUM") ?? "",
  roomId: Deno.env.get("AGENT_FORUM_DASHBOARD_ROOM") ?? "",
  ...(Deno.env.get("AGENT_FORUM_DASHBOARD_IDENTITY") ? { identityId: Deno.env.get("AGENT_FORUM_DASHBOARD_IDENTITY")! } : {}),
};
const clients = new Map<string, ClientInput>();
let shuttingDown = false;
let desktopWindow: Deno.BrowserWindow | undefined;
// 标准 Wayland 不提供普通应用可请求的全局置顶层；不能把无效调用伪装成已置顶。
const alwaysOnTopSupported = !(Deno.build.os === "linux" && Boolean(Deno.env.get("WAYLAND_DISPLAY")));
let desktopAlwaysOnTop = alwaysOnTopSupported;

function dashboardCliEnvironment(): Record<string, string> {
  const childEnv: Record<string, string> = { ...Deno.env.toObject(), HOME: home!, ...(Deno.build.os === "windows" ? { USERPROFILE: home! } : {}) };
  // Deno Desktop 将自身 loopback 端口暴露为 PORT；Viewer 必须请求独立的随机端口，不能继承该值。
  delete childEnv.PORT;
  return childEnv;
}

async function runCli(args: string[]) {
  const command = new Deno.Command(cli, { args: [...(cliScript ? [cliScript] : []), "--json", ...args], stdout: "piped", stderr: "piped", clearEnv: true, env: dashboardCliEnvironment() });
  const result = await command.output();
  const stdout = new TextDecoder().decode(result.stdout).trim();
  if (!result.success || !stdout) { const stderr = new TextDecoder().decode(result.stderr).trim(); throw new Error(stderr || `agent-forum command failed (exit ${result.code}, stdout ${stdout || "empty"})`); }
  const parsed = JSON.parse(stdout) as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  if (parsed.ok === false) throw new Error(`${parsed.error?.code ?? "CLI_ERROR"}: ${parsed.error?.message ?? "unknown error"}`);
  return parsed.data;
}
const backgroundCliProcesses = new Set<Deno.ChildProcess>();
function startCli(args: string[]): Promise<boolean> {
  const commandArgs = [...(cliScript ? [cliScript] : []), "--json", ...args];
  try {
    const child = new Deno.Command(cli, { args: commandArgs, stdout: "piped", stderr: "piped", clearEnv: true, env: dashboardCliEnvironment() }).spawn();
    backgroundCliProcesses.add(child);
    void new Response(child.stdout).text().then((message) => { if (message.trim()) console.log("Dashboard background CLI stdout", message.trim()); });
    void new Response(child.stderr).text().then((message) => { if (message.trim()) console.error("Dashboard background CLI stderr", message.trim()); });
    return child.status.then((status) => status.success).catch(() => false).finally(() => backgroundCliProcesses.delete(child));
  } catch (error) {
    console.error("Dashboard background CLI failed", error);
    return Promise.resolve(false);
  }
}

function validClient(value: unknown): value is ClientInput {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.clientId === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(item.clientId) &&
    typeof item.clientType === "string" && ["pi", "opencode", "codex", "claude-code"].includes(item.clientType) &&
    typeof item.forumAlias === "string" && item.forumAlias.length > 0 && typeof item.roomId === "string" && item.roomId.length > 0 &&
    (item.identityId === undefined || typeof item.identityId === "string");
}

async function attachLease(input: ClientInput) {
  if (!validClient(input)) throw new Error("invalid Dashboard client");
  const args = ["dashboard", "attach", "--client-id", input.clientId, "--client-type", input.clientType, "--forum", input.forumAlias, "--room", input.roomId];
  if (input.clientType !== "pi") args.push("--lease-ms", "300000");
  if (input.identityId) args.push("--identity", input.identityId);
  await runCli(args);
  clients.set(input.clientId, input);
}

async function detachLease(clientId: string) {
  clients.delete(clientId);
  await runCli(["dashboard", "detach", "--client-id", clientId]).catch(() => undefined);
}

async function attachToExisting(input: ClientInput): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const runtime = JSON.parse(await Deno.readTextFile(desktopFile)) as { port: number; token: string };
      const response = await fetch(`http://127.0.0.1:${runtime.port}/attach`, { method: "POST", headers: { authorization: `Bearer ${runtime.token}`, "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(1_000) });
      if (response.ok) return true;
    } catch { /* first instance may still be starting */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}

await Deno.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
let lock: Deno.FsFile;
try { lock = await Deno.open(lockFile, { createNew: true, write: true, mode: 0o600 }); }
catch (error) {
  if (error instanceof Deno.errors.AlreadyExists && await attachToExisting(initialClient)) Deno.exit(0);
  await Deno.remove(lockFile).catch(() => undefined);
  await Deno.remove(desktopFile).catch(() => undefined);
  lock = await Deno.open(lockFile, { createNew: true, write: true, mode: 0o600 });
}

function authorized(request: Request, url: URL): boolean {
  return request.headers.get("authorization") === `Bearer ${token}` || url.searchParams.get("token") === token;
}

function page(apiBase: string, pageToken: string, demoExtremeCounts = false, topSupported = true): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Agent Forum Dashboard</title>
<style>
:root{color-scheme:light;font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1d1d1f}*{box-sizing:border-box}body{margin:0;min-width:620px;overflow:hidden;background:linear-gradient(135deg,#f8fafc,#edf2f9)}.bar{position:relative;height:124px;padding:8px 10px;background:rgba(246,248,252,.92);border:1px solid rgba(255,255,255,.9);border-radius:14px;box-shadow:0 10px 28px rgba(31,45,61,.16);backdrop-filter:blur(24px)}.teams{height:42px;display:flex;align-items:center;gap:7px;padding:0 2px;-webkit-app-region:drag}.brand{display:flex;align-items:center;gap:7px;min-width:106px;color:#1d1d1f}.brandmark{display:block;width:27px;height:27px;filter:drop-shadow(0 3px 6px rgba(19,31,52,.22))}.brand strong{display:block;font-size:13px;letter-spacing:-.15px}.brand small{display:block;color:#7a7e87;font-size:9px;font-weight:650;letter-spacing:.5px;text-transform:uppercase}.team-tabs{display:flex;flex:1;min-width:0;align-items:center;gap:5px;overflow:hidden}.team{height:34px;min-width:0;display:flex;align-items:center;overflow:hidden;border:1px solid transparent;-webkit-app-region:no-drag;border-radius:10px;background:rgba(222,227,235,.68);color:#51545b;padding:0 10px;cursor:pointer;white-space:nowrap;font-weight:650;transition:.16s}.team-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.many-teams .team{flex:1 1 0;padding:0 6px}.many-teams .team.active{flex-grow:3}.many-teams .team-prefix{display:none}.many-teams .team .dot{margin-right:4px}.team:hover{background:#e4e9f2}.team.active{background:#fff;color:#202124;border-color:rgba(73,100,150,.13);box-shadow:0 2px 7px rgba(28,39,56,.1)}.team .dot{display:inline-block;flex:0 0 auto;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}.rooms{height:64px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;align-items:stretch;padding:7px 2px 0;overflow:hidden}.room{position:relative;display:flex;align-items:center;gap:9px;min-width:0;max-width:none;-webkit-app-region:no-drag;overflow:hidden;border:1px solid rgba(80,95,118,.14);border-radius:12px;background:rgba(255,255,255,.82);box-shadow:0 2px 7px rgba(37,50,71,.07);padding:8px 9px;cursor:pointer;transition:.16s}.room:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(37,50,71,.12)}.room.selected{border-color:#4f80e8;box-shadow:inset 4px 0 #4f80e8,0 0 0 2px rgba(79,128,232,.16),0 4px 12px rgba(37,50,71,.12)}.room-name{min-width:0;flex:1;overflow:hidden;font-size:12px;font-weight:680;letter-spacing:-.1px}.title-viewport{min-width:0;overflow:hidden;white-space:nowrap}.title-track{display:inline-block;width:max-content;white-space:nowrap;padding-right:26px;will-change:transform}.agent{display:block;margin-top:3px;color:#4c9a70;font-size:9px;font-weight:700}.metrics{margin-left:auto;display:flex;flex-direction:column;gap:2px;align-items:flex-end;font-variant-numeric:tabular-nums;min-width:38px}.metric{display:flex;align-items:center;justify-content:flex-end;gap:3px;min-width:38px;white-space:nowrap;color:#7d838e;font-size:10px;font-weight:700}.metric svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.metric.related{color:#e36b7e}.metric.broadcast{color:#d59627}.metric.other{color:#8a94a4}.right{margin-left:auto;display:flex;gap:5px;align-items:center;-webkit-app-region:no-drag}.button{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(76,91,116,.16);background:rgba(255,255,255,.72);color:#5d6470;border-radius:10px;padding:0;cursor:pointer;font:650 11px inherit;transition:.16s}.button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.button:hover{background:#fff;box-shadow:0 2px 6px rgba(37,50,71,.1)}.button:disabled{cursor:not-allowed;opacity:.42}.button.on{background:#e9f0ff;border-color:#b5cdfb;color:#356bd6}.button.close{color:#d35c69}.button.on{box-shadow:inset 0 0 0 1px rgba(53,107,214,.08)}.button.syncing svg{animation:dashboard-spin .9s linear 1}@keyframes dashboard-spin{to{transform:rotate(360deg)}}.error{padding:14px;color:#c45062}.compact{height:62px;padding:7px 10px}.compact .teams{height:0;padding:0}.compact .brand,.compact .team-tabs{display:none}.compact .right{display:flex;position:absolute;right:10px;top:15px;z-index:2;gap:5px}.compact .rooms{height:48px;padding:5px 194px 0 2px;grid-template-columns:1fr}.compact .room{height:40px;border-radius:10px;padding:4px 7px}.compact .room-name{font-size:11px}.compact .title-track{padding-right:18px}.compact .metrics{flex-direction:row;gap:4px;min-width:0}.compact .metric{font-size:9px}.compact .agent{display:none}.expanded{height:344px}.expanded .rooms{height:264px;margin-right:38px;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:64px;align-content:start;overflow-y:auto;padding:7px 0;scrollbar-width:none}.expanded .rooms::-webkit-scrollbar{display:none}.room-scrollbar{display:none}.expanded .room-scrollbar{display:block;position:absolute;right:5px;top:49px;bottom:39px;width:28px;border:1px solid rgba(76,91,116,.16);border-radius:8px;background:rgba(255,255,255,.5);overflow:hidden;-webkit-app-region:no-drag}.room-scroll-thumb{position:absolute;left:2px;top:2px;width:22px;min-height:28px;border:1px solid #b5cdfb;border-radius:6px;background:#e3ecff;box-shadow:0 1px 3px rgba(53,107,214,.12);cursor:grab}.room-scroll-thumb:active{cursor:grabbing;background:#d5e3ff}.room-more{position:absolute;right:5px;bottom:5px;z-index:3;width:28px;height:24px;border-radius:8px}.room-more svg{width:14px;height:14px}.bar.has-more:not(.expanded) .rooms{padding-right:38px}.rail{height:10px;padding:0;border-radius:0}.rail .teams{height:8px;padding:0;gap:2px}.rail .brand,.rail .right{display:none}.rail .team-tabs{width:100%;height:8px;gap:2px}.rail .team{height:8px;flex:1;padding:0;font-size:0;border-radius:0}.rail .team.active{box-shadow:none;border-color:rgba(255,255,255,.8)}.rail .rooms{display:none}.status{color:#8b929e;font-size:10px}.notice{position:fixed;z-index:20;right:10px;bottom:8px;display:flex;max-width:min(460px,calc(100vw - 20px));align-items:center;gap:8px;padding:7px 8px 7px 10px;border:1px solid #efb7bf;border-radius:9px;background:rgba(255,247,248,.97);box-shadow:0 5px 16px rgba(80,34,42,.18);color:#9c3545;font-size:11px;line-height:1.35;word-break:break-word;-webkit-app-region:no-drag}.notice button{flex:0 0 auto;width:20px;height:20px;border:0;border-radius:5px;background:transparent;color:inherit;cursor:pointer;font-size:16px;line-height:1}.notice button:hover{background:#f8dfe3}
#room-panel{display:none;max-height:520px;overflow-y:auto;padding:10px 12px 14px;background:linear-gradient(180deg,rgba(248,250,254,.96),rgba(237,242,249,.98));border:1px solid rgba(255,255,255,.85);border-top:none;border-radius:0 0 14px 14px;box-shadow:0 12px 32px rgba(31,45,61,.14);backdrop-filter:blur(20px);font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d1d1f;scrollbar-width:thin;scrollbar-color:#c8cdd6 transparent}#room-panel::-webkit-scrollbar{width:6px}#room-panel::-webkit-scrollbar-thumb{background:#c8cdd6;border-radius:3px}.room-view{height:100vh;padding:0;overflow:hidden;border-radius:14px;background:linear-gradient(145deg,#f8fafc,#e9eff8);border:1px solid rgba(255,255,255,.92);box-shadow:0 10px 28px rgba(31,45,61,.16);animation:room-enter .24s cubic-bezier(.2,.8,.2,1)}.room-view .rv-toolbar{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 15px;border-bottom:1px solid rgba(80,95,118,.12);background:rgba(250,252,255,.86);backdrop-filter:blur(20px);-webkit-app-region:drag}.room-view .rv-context{display:flex;align-items:center;gap:9px;min-width:0}.room-view .rv-mark{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#0c101a;color:#70e1d0;font-size:15px;font-weight:800}.room-view .rv-title{min-width:0;font-size:13px;font-weight:750;letter-spacing:-.15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.room-view .rv-subtitle{margin-top:1px;font-size:9px;color:#7a7e87}.room-view .rv-toolbar .button{-webkit-app-region:no-drag}.room-view #room-panel{display:block;height:calc(100vh - 52px);max-height:none;overflow-y:auto;padding:10px 14px 16px;border:0;border-radius:0;background:transparent;box-shadow:none}.room-view .rp-header{padding-top:0}.room-view .rp-section{margin-top:12px}@keyframes room-enter{from{opacity:.35;transform:scale(.985)}to{opacity:1;transform:scale(1)}}.rp-loading{padding:24px;text-align:center;color:#8b929e}.rp-empty{padding:24px;text-align:center;color:#8b929e}.rp-header{position:sticky;top:0;z-index:2;padding:8px 0 6px;background:linear-gradient(180deg,rgba(248,250,254,.98) 80%,transparent);border-bottom:1px solid rgba(80,95,118,.1)}.rp-room-name{font-size:16px;font-weight:750;letter-spacing:-.3px;color:#1a1d23}.rp-room-desc{font-size:11px;color:#6b7280;margin-top:2px}.rp-info{font-size:10px;color:#8b929e;margin-top:4px;font-variant-numeric:tabular-nums}.rp-section{margin-top:10px}.rp-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#8b929e;margin-bottom:5px}.rp-thread{border:1px solid rgba(80,95,118,.12);border-radius:8px;background:rgba(255,255,255,.7);margin-bottom:4px;overflow:hidden;transition:.15s}.rp-thread:hover{border-color:rgba(79,128,232,.25)}.rp-thread.open{border-color:rgba(79,128,232,.3);box-shadow:0 2px 8px rgba(79,128,232,.08)}.rp-thread-head{display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;-webkit-app-region:no-drag}.rp-thread-kind{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:2px 6px;border-radius:4px;background:rgba(79,128,232,.1);color:#4f80e8;flex-shrink:0}.rp-thread-title{font-size:12px;font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.rp-thread-meta{font-size:9px;color:#8b929e;white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums}.rp-messages{padding:4px 8px 8px;border-top:1px solid rgba(80,95,118,.08);max-height:280px;overflow-y:auto}.rp-msg{display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(80,95,118,.06)}.rp-msg:last-child{border-bottom:none}.rp-avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0}.rp-msg-body{min-width:0;flex:1}.rp-msg-author{font-weight:650;font-size:11px}.rp-msg-type{font-size:9px;color:#8b929e;text-transform:uppercase}.rp-msg-time{font-size:9px;color:#a0a6b0;margin-left:4px}.rp-msg-text{font-size:11px;color:#3d4250;margin-top:2px;line-height:1.45;white-space:pre-wrap;word-break:break-word}.rp-member{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(80,95,118,.06)}.rp-member:last-child{border-bottom:none}.rp-member.idle{opacity:.45}.rp-member-name{font-size:11px;font-weight:650;min-width:60px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rp-member-role{font-size:9px;color:#8b929e;min-width:48px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rp-bar-track{flex:1;height:6px;background:rgba(80,95,118,.08);border-radius:3px;overflow:hidden;min-width:40px}.rp-bar-fill{height:100%;background:linear-gradient(90deg,#4f80e8,#68c6e3);border-radius:3px;transition:width .4s ease-out}.rp-member-count{font-size:9px;color:#6b7280;font-variant-numeric:tabular-nums;min-width:42px;text-align:right}.rp-member-time{font-size:9px;color:#a0a6b0;min-width:48px;text-align:right}.rp-pulse{width:6px;height:6px;border-radius:50%;background:#4c9a70;animation:rp-breathe 2s ease-in-out infinite;flex-shrink:0}@keyframes rp-breathe{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
</style><div id="app" class="bar"><div class="error">Loading Dashboard…</div></div>
<script>
let selected,selectedRoomId,mode=0,revision=-1,lastData,alwaysOnTop=${JSON.stringify(alwaysOnTopSupported)},pollingSequence=-1,roomPanelExpanded=false,roomPanelOpen=false,roomPanelData=null,roomPanelLoading=false,expandedThreadId=null;const topSupported=${JSON.stringify(topSupported)},roomOrders=new Map(),selectedRoomIds=new Map(),teamSignatures=new Map(),app=document.getElementById('app'),apiBase=${JSON.stringify(apiBase)},token=${JSON.stringify(pageToken)},demoExtreme=${JSON.stringify(demoExtremeCounts)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),color=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+' 72% 62%)'};
const icon=name=>({eye:'<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5z"/><circle cx="12" cy="12" r="2.5"/></svg>',eyeClosed:'<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5z"/><circle cx="12" cy="12" r="2.5"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2.2"/></svg>',polling:'<svg viewBox="0 0 24 24"><path d="M5 8a8 8 0 0 1 13-2l2 2M19 16a8 8 0 0 1-13 2l-2-2M20 8h-4M4 16h4"/></svg>',top:'<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 5 3 3v2H6v-2l3-3-1-5M12 13v8"/></svg>',up:'<svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></svg>',down:'<svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6"/></svg>',close:'<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>'}[name]||'');
let noticeTimer;
function showNotice(message){const text=String(message||'Dashboard action failed').replace(/\\s+/g,' ').slice(0,360);let notice=document.getElementById('dashboard-notice');if(!notice){notice=document.createElement('div');notice.id='dashboard-notice';notice.className='notice';notice.setAttribute('role','alert');const label=document.createElement('span');label.className='notice-text';const dismiss=document.createElement('button');dismiss.type='button';dismiss.setAttribute('aria-label','dismiss message');dismiss.textContent='×';dismiss.onclick=()=>notice.remove();notice.append(label,dismiss);document.body.append(notice)}notice.querySelector('.notice-text').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.remove(),10000)}
function bindMarquees(){document.querySelectorAll('[data-marquee]').forEach(room=>{const viewport=room.querySelector('.title-viewport'),track=room.querySelector('.title-track');if(!viewport||!track)return;let position=0,velocity=0,hovered=false,frame=0;const step=()=>{const maximum=Math.max(0,track.offsetWidth-viewport.clientWidth);const destination=hovered?maximum:0;const distance=destination-position;velocity+=distance*.004;velocity*=.88;position+=velocity;if(Math.abs(distance)<.35&&Math.abs(velocity)<.04){position=destination;track.style.transform='translate3d('+(-position)+'px,0,0)';frame=0;return}track.style.transform='translate3d('+(-position)+'px,0,0)';frame=requestAnimationFrame(step)};const start=()=>{hovered=true;if(!frame)frame=requestAnimationFrame(step)};const stop=()=>{hovered=false;if(!frame)frame=requestAnimationFrame(step)};room.addEventListener('mouseenter',start);room.addEventListener('mouseleave',stop);room.addEventListener('pointerenter',start);room.addEventListener('pointerleave',stop);room.addEventListener('focusin',start);room.addEventListener('focusout',stop)})}
function bindRoomScroll(){const rooms=document.querySelector('.expanded .rooms'),rail=document.getElementById('room-scrollbar'),thumb=document.getElementById('room-scroll-thumb');if(!rooms||!rail||!thumb)return;const update=()=>{const track=Math.max(0,rail.clientHeight-4),ratio=Math.min(1,rooms.clientHeight/Math.max(rooms.scrollHeight,1)),height=Math.max(28,Math.round(track*ratio)),maximumTop=Math.max(0,track-height),maximumScroll=Math.max(0,rooms.scrollHeight-rooms.clientHeight),top=maximumScroll?maximumTop*rooms.scrollTop/maximumScroll:0;thumb.style.height=height+'px';thumb.style.transform='translateY('+top+'px)'};rooms.addEventListener('scroll',update,{passive:true});rail.addEventListener('wheel',event=>{event.preventDefault();rooms.scrollBy({top:event.deltaY,behavior:'smooth'})},{passive:false});rail.addEventListener('click',event=>{if(event.target===thumb)return;const rect=rail.getBoundingClientRect();rooms.scrollTo({top:(event.clientY-rect.top)/rect.height*rooms.scrollHeight,behavior:'smooth'})});thumb.addEventListener('pointerdown',event=>{event.preventDefault();thumb.setPointerCapture(event.pointerId);const startY=event.clientY,startScroll=rooms.scrollTop,available=Math.max(1,rail.clientHeight-4-thumb.offsetHeight),maximumScroll=Math.max(0,rooms.scrollHeight-rooms.clientHeight);const move=moveEvent=>{rooms.scrollTop=startScroll+(moveEvent.clientY-startY)*maximumScroll/available};const stop=()=>{thumb.removeEventListener('pointermove',move);thumb.removeEventListener('pointerup',stop);thumb.removeEventListener('pointercancel',stop)};thumb.addEventListener('pointermove',move);thumb.addEventListener('pointerup',stop);thumb.addEventListener('pointercancel',stop)});requestAnimationFrame(update)}
async function api(path,body){const r=await fetch(apiBase+path+'?token='+encodeURIComponent(token),{method:body?'POST':'GET',headers:body?{'content-type':'text/plain'}:{},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(await r.text());return r.json()}
function animatePolling(){const button=document.getElementById('poll');if(!button)return;button.classList.remove('syncing');void button.offsetWidth;button.classList.add('syncing');button.addEventListener('animationend',()=>button.classList.remove('syncing'),{once:true})}
async function refreshPollingStatus(){try{const status=await api('/polling-status');if(pollingSequence<0){pollingSequence=status.sequence;return}if(status.sequence!==pollingSequence){pollingSequence=status.sequence;if(status.lastForumId===selected)animatePolling()}}catch{} }
function swapRoomToFront(forumId,roomId){const order=roomOrders.get(forumId);if(!order)return;const index=order.indexOf(roomId);if(index>0)[order[0],order[index]]=[order[index],order[0]]}
function roomSignature(team){return team.rooms.map(room=>room.roomId+':'+room.title+':'+room.counts.related+':'+room.counts.broadcast+':'+room.counts.other+':'+room.pinned).join('|')}
function render(data,reconcile=false){const previousRoomRects=new Map(Array.from(app.querySelectorAll('[data-room]')).map(element=>[element.dataset.room,element.getBoundingClientRect()]));lastData=data;revision=data.revision;const rawTeams=data.teams||[];const teams=demoExtreme?rawTeams.map((teamItem,teamIndex)=>teamIndex===0?{...teamItem,rooms:teamItem.rooms.map((room,roomIndex)=>roomIndex===0?{...room,counts:{related:999,broadcast:999,other:999}}:room)}:teamItem):rawTeams;if(!selected||!teams.some(t=>t.forumId===selected))selected=teams[0]?.forumId;const team=teams.find(t=>t.forumId===selected);if(!team){app.innerHTML='<div class="error">No active Agent Forum Dashboard clients.</div>';return}if(roomPanelOpen){renderRoomView(team);return}const rememberedRoomId=selectedRoomIds.get(team.forumId);const focusRoom=team.rooms.find(r=>r.roomId===rememberedRoomId)||team.rooms.find(r=>r.activeLocalAgents)||team.rooms[0];if(focusRoom)selectedRoomId=focusRoom.roomId;selectedRoomIds.set(team.forumId,selectedRoomId);const byRoomId=new Map(team.rooms.map(room=>[room.roomId,room]));const signature=roomSignature(team);const savedOrder=roomOrders.get(team.forumId)||[];const shouldReconcile=reconcile&&teamSignatures.get(team.forumId)!==signature;const defaultOrder=team.rooms.map(room=>room.roomId);const baseOrder=shouldReconcile||savedOrder.length===0?defaultOrder:savedOrder;const roomIds=[...(selectedRoomId&&baseOrder.includes(selectedRoomId)?[selectedRoomId]:[]),...baseOrder.filter(roomId=>roomId!==selectedRoomId&&byRoomId.has(roomId)),...defaultOrder.filter(roomId=>!baseOrder.includes(roomId))];roomOrders.set(team.forumId,roomIds);teamSignatures.set(team.forumId,signature);const orderedRooms=roomIds.map(roomId=>byRoomId.get(roomId)).filter(Boolean);const displayedRooms=mode===1?(focusRoom?[focusRoom]:[]):mode===3?orderedRooms:orderedRooms.slice(0,3);app.className='bar'+(mode===1?' compact':mode===2?' rail':mode===3?' expanded':'')+(team.rooms.length>3&&mode!==1?' has-more':'')+(teams.length>3?' many-teams':'');app.innerHTML='<div class="teams"><div class="brand"><svg class="brandmark" viewBox="0 0 64 64" aria-label="Agent Forum"><rect x="3" y="3" width="58" height="58" rx="14" fill="#0c101a"/><path d="M16 17v6l5 5h28" fill="none" stroke="#67a4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 28v4l5 6h17" fill="none" stroke="#68c6e3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 38v3l6 5h6" fill="none" stroke="#70e1d0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><span><strong>Forum</strong><small>Forums</small></span></div><div class="team-tabs">'+teams.map(t=>'<button class="team '+(t.forumId===selected?'active':'')+'" data-team="'+esc(t.forumId)+'"><span class="dot" style="background:'+color(t.forumId)+'"></span><span class="team-label"><span class="team-prefix">Forum alias · </span>'+esc(t.forumAlias)+'</span></button>').join('')+'</div><div class="right"><button class="button '+(roomPanelOpen?'on':'')+'" id="viewer" aria-label="'+(roomPanelOpen?'close room panel':'open room panel')+'">'+icon(roomPanelOpen?'eyeClosed':'eye')+'</button><button class="button '+(alwaysOnTop?'on':'')+'" id="top" aria-label="'+(topSupported?'top':'always-on-top unavailable on Wayland')+'" '+(topSupported?'':'disabled')+'>'+icon('top')+'</button><button class="button '+(team.polling?'on':'')+'" id="poll" aria-label="polling">'+icon('polling')+'</button><button class="button" id="collapse" aria-label="'+(mode===1?'expand':'collapse')+'">'+icon(mode===1?'down':'up')+'</button><button class="button close" id="close" aria-label="close">'+icon('close')+'</button></div></div><div class="rooms">'+displayedRooms.map(r=>'<div class="room '+(r.roomId===selectedRoomId?'selected':'')+'" data-room="'+esc(r.roomId)+'" data-marquee aria-label="Select Room '+esc(r.title)+'"><div class="room-name"><div class="title-viewport"><span class="title-track">'+esc(r.title)+'</span></div>'+(r.activeLocalAgents?'<span class="agent">● Active here</span>':'')+'</div><div class="metrics"><span class="metric related"><svg viewBox="0 0 16 16"><path d="M3 3.5h10v7H7l-3 2v-2H3z"/></svg><b>'+r.counts.related+'</b></span><span class="metric broadcast"><svg viewBox="0 0 16 16"><path d="M3 7h3l5-3v8l-5-3H3zM6 10.5v2"/></svg><b>'+r.counts.broadcast+'</b></span><span class="metric other"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M8 5.5v3l2 1.5"/></svg><b>'+r.counts.other+'</b></span></div></div>').join('')+'</div>'+(team.rooms.length>3&&mode===3?'<div class="room-scrollbar" id="room-scrollbar"><div class="room-scroll-thumb" id="room-scroll-thumb"></div></div>':'')+(team.rooms.length>3&&mode!==1?'<button class="button room-more" id="room-more" aria-label="'+(mode===3?'collapse rooms':'expand rooms')+'">'+icon(mode===3?'up':'down')+'</button>':'');requestAnimationFrame(()=>{document.querySelectorAll('[data-room]').forEach(element=>{const previous=previousRoomRects.get(element.dataset.room),next=element.getBoundingClientRect();if(previous){const dx=previous.left-next.left,dy=previous.top-next.top;if(Math.abs(dx)>1||Math.abs(dy)>1)element.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)'});}else element.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'});});});document.querySelectorAll('[data-team]').forEach(x=>x.onclick=()=>{selected=x.dataset.team;if(mode===2){void setMode(0);return}const nextTeam=teams.find(teamItem=>teamItem.forumId===selected);if(mode!==1){const nextMode=roomPanelExpanded&&nextTeam&&nextTeam.rooms.length>3?3:0;if(nextMode!==mode){void setMode(nextMode);return}}render(data)});document.querySelectorAll('[data-room]').forEach(x=>x.onclick=()=>{selectedRoomId=x.dataset.room;selectedRoomIds.set(team.forumId,selectedRoomId);swapRoomToFront(team.forumId,selectedRoomId);render(data)});document.getElementById('viewer').onclick=()=>{roomPanelOpen=!roomPanelOpen;void toggleRoomPanel(team)};document.getElementById('collapse').onclick=()=>setMode(mode===1?(roomPanelExpanded&&team.rooms.length>3?3:0):1);document.getElementById('room-more')?.addEventListener('click',()=>{roomPanelExpanded=!roomPanelExpanded;void setMode(roomPanelExpanded?3:0)});document.getElementById('close').onclick=()=>{app.style.opacity='0';app.style.pointerEvents='none';void api('/close',{})};document.getElementById('top').onclick=async()=>{if(!topSupported)return;const result=await api('/top',{enabled:!alwaysOnTop});alwaysOnTop=result.enabled;render(data)};document.getElementById('poll').onclick=async()=>{const sourceTeam=rawTeams.find(teamItem=>teamItem.forumId===team.forumId),enabled=!team.polling;if(sourceTeam)sourceTeam.polling=enabled;render(data);try{await api('/poll',{forumId:team.forumId,enabled})}catch{if(sourceTeam)sourceTeam.polling=!enabled;render(data)}};bindMarquees();bindRoomScroll()}
function memberColor(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))%360;return'hsl('+h+' 55% 48%)'}
function memberInitials(name){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('')}
function timeAgo(iso){if(!iso)return'never';const diff=Date.now()-new Date(iso).getTime();if(diff<60000)return'just now';if(diff<3600000)return Math.floor(diff/60000)+'m ago';if(diff<86400000)return Math.floor(diff/3600000)+'h ago';return Math.floor(diff/86400000)+'d ago'}
function isRecent(iso){return iso&&Date.now()-new Date(iso).getTime()<600000}
function renderRoomPanel(data){if(!data)return'<div class="rp-empty">No room data.</div>';const maxMsg=Math.max(1,...data.members.map(m=>m.messageCount));return'<div class="rp-header"><div class="rp-room-name">'+esc(data.room.title)+'</div><div class="rp-room-desc">'+esc(data.room.description)+'</div><div class="rp-info">'+esc(data.forum.name)+' · '+esc(data.forum.dataBranch)+' · '+timeAgo(data.syncedAt)+' · '+data.stats.threadCount+' threads · '+data.stats.messageCount+' messages · '+data.stats.memberCount+' members</div></div><div class="rp-section"><div class="rp-section-title">Threads</div>'+data.threads.map(t=>'<div class="rp-thread'+(expandedThreadId===t.id?' open':'')+'" data-thread="'+esc(t.id)+'"><div class="rp-thread-head"><span class="rp-thread-kind">'+esc(t.kind)+'</span><span class="rp-thread-title">'+esc(t.title)+'</span><span class="rp-thread-meta">'+esc(t.authorName)+' · '+t.replyCount+' replies · '+timeAgo(t.lastActivityAt)+'</span></div>'+(expandedThreadId===t.id?'<div class="rp-messages">'+t.messages.map(m=>'<div class="rp-msg" style="margin-left:'+(m.replyTo?24:0)+'px"><span class="rp-avatar" style="background:'+memberColor(m.authorId)+'">'+esc(memberInitials(m.authorName))+'</span><div class="rp-msg-body"><span class="rp-msg-author">'+esc(m.authorName)+'</span> <span class="rp-msg-type">'+esc(m.type)+'</span> <span class="rp-msg-time">'+timeAgo(m.createdAt)+'</span><div class="rp-msg-text">'+esc(m.body.slice(0,500))+(m.body.length>500?'…':'')+'</div></div></div>').join('')+'</div>':'')+'</div>').join('')+'</div><div class="rp-section"><div class="rp-section-title">Members · by activity</div>'+data.members.map(m=>'<div class="rp-member'+(m.messageCount===0?' idle':'')+'"><span class="rp-avatar" style="background:'+memberColor(m.id)+'">'+esc(memberInitials(m.displayName))+'</span><span class="rp-member-name">'+esc(m.displayName)+'</span><span class="rp-member-role">'+esc(m.role)+'</span><div class="rp-bar-track"><div class="rp-bar-fill" style="width:'+Math.round(m.messageCount/maxMsg*100)+'%"></div></div><span class="rp-member-count">'+m.messageCount+' msgs</span><span class="rp-member-time">'+(m.lastMessageAt?timeAgo(m.lastMessageAt):'never')+'</span>'+(isRecent(m.lastMessageAt)?'<span class="rp-pulse"></span>':'')+'</div>').join('')+'</div>'}
function bindRoomThreads(team){app.querySelectorAll('[data-thread]').forEach(el=>{el.querySelector('.rp-thread-head')?.addEventListener('click',()=>{const tid=el.dataset.thread;expandedThreadId=expandedThreadId===tid?null:tid;renderRoomView(team)})})}
function renderRoomView(team){const roomId=selectedRoomIds.get(team.forumId)||selectedRoomId||team.rooms[0]?.roomId;const selectedRoom=team.rooms.find(r=>r.roomId===roomId)||team.rooms[0];app.className='room-view';app.innerHTML='<div class="rv-toolbar"><div class="rv-context"><span class="rv-mark">#</span><div><div class="rv-title">'+esc(roomPanelData?.room?.title||selectedRoom?.title||'Room')+'</div><div class="rv-subtitle">Forum alias · '+esc(team.forumAlias)+' · Room overview</div></div></div><button class="button on" id="viewer" aria-label="close room page">'+icon('eyeClosed')+'</button></div><div id="room-panel">'+(roomPanelLoading?'<div class="rp-loading">Loading room…</div>':renderRoomPanel(roomPanelData))+'</div>';app.querySelector('#viewer').onclick=()=>{roomPanelOpen=false;void toggleRoomPanel(team)};bindRoomThreads(team);requestAnimationFrame(()=>app.animate([{opacity:.45,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'}))}
async function toggleRoomPanel(team){if(!roomPanelOpen){roomPanelData=null;roomPanelLoading=false;expandedThreadId=null;await api('/window',{mode,panelHeight:0});render(lastData);return}const forumAlias=team.forumAlias,roomId=selectedRoomIds.get(team.forumId)||selectedRoomId||team.rooms[0]?.roomId;if(!roomId){roomPanelOpen=false;showNotice('No room selected.');render(lastData);return}roomPanelLoading=true;roomPanelData=null;expandedThreadId=null;await api('/window',{mode,panelHeight:430});render(lastData);try{roomPanelData=await api('/room-panel',{forumAlias,roomId});roomPanelLoading=false;render(lastData)}catch(e){roomPanelOpen=false;roomPanelLoading=false;roomPanelData=null;await api('/window',{mode,panelHeight:0});render(lastData);showNotice('Room page failed: '+e.message)}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&roomPanelOpen){roomPanelOpen=false;expandedThreadId=null;void toggleRoomPanel(lastData?.teams?.find(t=>t.forumId===selected)||{forumId:'',forumAlias:'',rooms:[]})}});
async function setMode(next){mode=next;await api('/window',{mode,panelHeight:roomPanelOpen?430:0});render(lastData)}
async function refresh(force=false){try{const data=await api('/snapshot');if(force||data.revision!==revision)render(data,true)}catch(e){showNotice('Dashboard refresh failed: '+e.message)}void refreshPollingStatus()}
setInterval(refresh,1000);api('/ready',{}).then(()=>refresh(true)).catch(e=>showNotice('Dashboard startup failed: '+e.message));
</script>`;
}

await attachLease(initialClient);
interface PendingPollingPreference { enabled: boolean; generation: number }
const pendingPollingPreferences = new Map<string, PendingPollingPreference>();
let pollingPreferenceGeneration = 0;
function applyPendingPollingPreferences(value: unknown): unknown {
  if (pendingPollingPreferences.size === 0 || !value || typeof value !== "object") return value;
  const snapshot = value as { teams?: Array<Record<string, unknown> & { forumId?: string }> };
  return { ...snapshot, teams: (snapshot.teams ?? []).map((team) => {
    const pending = typeof team.forumId === "string" ? pendingPollingPreferences.get(team.forumId) : undefined;
    return pending ? { ...team, polling: pending.enabled } : team;
  }) };
}
let cachedSnapshot = await runCli(["dashboard", "snapshot"]);
let snapshotRefresh: Promise<void> | undefined;
function refreshSnapshot(): Promise<void> {
  snapshotRefresh ??= runCli(["dashboard", "snapshot"]).then((value) => { cachedSnapshot = applyPendingPollingPreferences(value); }).finally(() => { snapshotRefresh = undefined; });
  return snapshotRefresh;
}
let resolveStartupReady!: () => void;
const startupReady = new Promise<void>((resolveReady) => { resolveStartupReady = resolveReady; });
const corsHeaders = { "access-control-allow-origin": "*", "cache-control": "no-store" };
const jsonResponse = (value: unknown) => Response.json(value, { headers: corsHeaders });
let pollingActiveForumIds = new Set<string>();
let pollingSequence = 0;
let lastPollingForumId: string | undefined;
let lastPollingStartedAt: string | undefined;
const demoExtremeCounts = Deno.env.get("AGENT_FORUM_DASHBOARD_EXTREME_COUNTS") === "1";
const server = Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" } });
  if (url.pathname === "/" && request.method === "GET") return new Response(page(url.origin, token, demoExtremeCounts, alwaysOnTopSupported), { headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" } });
  if (!authorized(request, url)) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  try {
    if (url.pathname === "/snapshot") return jsonResponse(cachedSnapshot);
    if (url.pathname === "/polling-status" && request.method === "GET") return jsonResponse({ sequence: pollingSequence, activeForumIds: [...pollingActiveForumIds], ...(lastPollingForumId ? { lastForumId: lastPollingForumId } : {}), ...(lastPollingStartedAt ? { lastStartedAt: lastPollingStartedAt } : {}) });
    if (url.pathname === "/ready" && request.method === "POST") { setTimeout(resolveStartupReady, 0); return jsonResponse({ ready: true }); }
    if (url.pathname === "/attach" && request.method === "POST") { await attachLease(await request.json() as ClientInput); await refreshSnapshot(); desktopWindow?.show(); desktopWindow?.focus(); return jsonResponse({ attached: true }); }
    if (url.pathname === "/detach" && request.method === "POST") { const value = await request.json() as { clientId?: string }; if (typeof value.clientId !== "string") return new Response("invalid client", { status: 400, headers: corsHeaders }); clients.delete(value.clientId); if (clients.size === 0) setTimeout(() => void shutdown(), 0); return jsonResponse({ detached: true }); }
    if (url.pathname === "/close" && request.method === "POST") { desktopWindow?.hide(); setTimeout(() => void shutdown(), 0); return jsonResponse({ closing: true }); }
    if (url.pathname === "/window" && request.method === "POST") { const value = await request.json() as { mode?: number; panelHeight?: number }; if (value.mode !== 0 && value.mode !== 1 && value.mode !== 3) return new Response("invalid window mode", { status: 400, headers: corsHeaders }); const barHeight = value.mode === 0 ? 124 : value.mode === 1 ? 62 : 344; const panel = typeof value.panelHeight === "number" && value.panelHeight > 0 ? Math.min(value.panelHeight, 520) : 0; desktopWindow?.setSize(670, barHeight + panel); return jsonResponse({ mode: value.mode, panelHeight: panel }); }
    if (url.pathname === "/room-panel" && request.method === "POST") { const value = await request.json() as { forumAlias?: string; roomId?: string }; if (typeof value.forumAlias !== "string" || typeof value.roomId !== "string") return new Response("invalid room panel request", { status: 400, headers: corsHeaders }); const data = await runCli(["viewer", "data", "--forum", value.forumAlias, "--room", value.roomId]); return jsonResponse(data); }
    if (url.pathname === "/top" && request.method === "POST") { const value = await request.json() as { enabled?: boolean }; if (typeof value.enabled !== "boolean") return new Response("invalid always-on-top request", { status: 400, headers: corsHeaders }); if (!alwaysOnTopSupported) return new Response("Always-on-top is unavailable under this Wayland session in this release; it requires an explicit GNOME Shell integration.", { status: 409, headers: corsHeaders }); desktopAlwaysOnTop = value.enabled; applyAlwaysOnTop(); return jsonResponse({ enabled: desktopAlwaysOnTop }); }
    if (url.pathname === "/poll" && request.method === "POST") {
      const value = await request.json() as { forumId?: string; enabled?: boolean };
      if (typeof value.forumId !== "string" || typeof value.enabled !== "boolean") return new Response("invalid polling request", { status: 400, headers: corsHeaders });
      const forumId = value.forumId;
      const preference = { enabled: value.enabled, generation: ++pollingPreferenceGeneration };
      pendingPollingPreferences.set(forumId, preference);
      const snapshot = cachedSnapshot as { revision?: number };
      cachedSnapshot = applyPendingPollingPreferences({ ...snapshot, revision: (snapshot.revision ?? 0) + 1 });
      void startCli(["dashboard", "polling", "--forum-id", forumId, "--enabled", String(value.enabled)]).then(async (success) => {
        if (pendingPollingPreferences.get(forumId)?.generation !== preference.generation) return;
        if (!success) {
          pendingPollingPreferences.delete(forumId);
          await refreshSnapshot().catch(() => undefined);
          return;
        }
        // 子进程退出与 runtime.json 的 rename/watch 可有极短竞态；只在新 snapshot 确认目标值后移除覆盖。
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const persisted = await runCli(["dashboard", "snapshot"]).catch(() => undefined) as { teams?: Array<{ forumId?: string; polling?: boolean }> } | undefined;
          if (pendingPollingPreferences.get(forumId)?.generation !== preference.generation) return;
          const persistedTeam = persisted?.teams?.find((team) => team.forumId === forumId);
          if (persistedTeam?.polling === preference.enabled) {
            pendingPollingPreferences.delete(forumId);
            cachedSnapshot = persisted;
            return;
          }
          if (persisted) cachedSnapshot = applyPendingPollingPreferences(persisted);
          await new Promise((resolveWait) => setTimeout(resolveWait, 100));
        }
        pendingPollingPreferences.delete(forumId);
        await refreshSnapshot().catch(() => undefined);
      });
      return jsonResponse({ forumId, enabled: value.enabled, pending: true });
    }
    if (url.pathname === "/pin" && request.method === "POST") { const value = await request.json() as { roomId?: string; enabled?: boolean }; if (typeof value.roomId !== "string" || typeof value.enabled !== "boolean") return new Response("invalid pin request", { status: 400, headers: corsHeaders }); const result = await runCli(["dashboard", "pin", "--room-id", value.roomId, "--enabled", String(value.enabled)]); await refreshSnapshot(); return jsonResponse(result); }
    if (url.pathname === "/viewer" && request.method === "POST") { const value = await request.json() as { forumAlias?: string; roomId?: string }; if (typeof value.forumAlias !== "string" || typeof value.roomId !== "string") return new Response("invalid Viewer request", { status: 400, headers: corsHeaders }); await runCli(["viewer", "open", "--forum", value.forumAlias, "--room", value.roomId, "--home", home]); return jsonResponse({ opening: true, forumAlias: value.forumAlias, roomId: value.roomId }); }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  } catch (error) { return new Response(error instanceof Error ? error.message : "Dashboard error", { status: 500, headers: corsHeaders }); }
});
const port = (server.addr as Deno.NetAddr).port;
const temporaryDesktopFile = `${desktopFile}.${crypto.randomUUID()}.tmp`;
await Deno.writeTextFile(temporaryDesktopFile, `${JSON.stringify({ formatVersion: 1, pid: Deno.pid, port, token }, null, 2)}\n`, { mode: 0o600 });
await Deno.rename(temporaryDesktopFile, desktopFile);

await startupReady;
// Deno Desktop 将第一个 BrowserWindow 绑定到带标题栏的隐式启动窗口，且会忽略 frameless。
// 隐藏该窗口后创建实际窗口，才能在 Windows 上可靠地移除原生标题栏。
const startupWindow = new Deno.BrowserWindow({ title: "Agent Forum Dashboard" });
startupWindow.hide();
desktopWindow = new Deno.BrowserWindow({ title: "Agent Forum Dashboard", width: 670, height: 124, x: 0, y: 0, alwaysOnTop: desktopAlwaysOnTop, frameless: true, resizable: false });
function applyAlwaysOnTop() {
  if (!alwaysOnTopSupported) return;
  desktopWindow?.setAlwaysOnTop(desktopAlwaysOnTop);
  // Linux CEF 可能在窗口映射前忽略构造参数；每次映射和用户切换时重新应用。
  if (desktopAlwaysOnTop) desktopWindow?.focus();
}
desktopWindow.navigate(`http://127.0.0.1:${port}/`);
// 启动窗口的自动导航可能晚于首次 hide；真实窗口建立后必须关闭它，避免留下第二个窗口。
setTimeout(() => { startupWindow.close(); desktopWindow?.show(); desktopWindow?.focus(); applyAlwaysOnTop(); configureWindowsWindow(); for (let attempt = 1; attempt < 8; attempt += 1) setTimeout(() => { applyAlwaysOnTop(); configureWindowsWindow(); }, attempt * 250); }, 500);
desktopWindow.addEventListener("close", () => { void shutdown(); });

const watcher = Deno.watchFs(stateDirectory);
const watcherTask = (async () => {
  for await (const event of watcher) {
    if (shuttingDown) break;
    if (event.paths.some((path) => path.replaceAll("\\", "/").endsWith("/runtime.json"))) await refreshSnapshot().catch(() => undefined);
  }
})();

let polling = false;
const pollingTimer = setInterval(async () => {
  if (polling || shuttingDown) return;
  polling = true;
  try {
    const snapshot = cachedSnapshot as { teams?: Array<{ forumId: string; forumAlias: string; polling: boolean }> };
    for (const team of snapshot.teams ?? []) if (team.polling) {
      pollingActiveForumIds.add(team.forumId);
      pollingSequence += 1;
      lastPollingForumId = team.forumId;
      lastPollingStartedAt = new Date().toISOString();
      try { await runCli(["forum", "sync", "--forum", team.forumAlias]).catch(() => undefined); }
      finally { pollingActiveForumIds.delete(team.forumId); }
    }
    await refreshSnapshot().catch(() => undefined);
  } finally { polling = false; }
}, 60_000);
const leaseTimer = setInterval(async () => {
  if (shuttingDown) return;
  try {
    const status = await runCli(["dashboard", "status"]) as { clients?: Array<{ clientId: string }> };
    const active = new Set((status.clients ?? []).map((client) => client.clientId));
    for (const id of clients.keys()) if (!active.has(id)) clients.delete(id);
    if (clients.size === 0) await shutdown();
  } catch { /* transient CLI failures must not destroy the window */ }
}, 10_000);

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(pollingTimer); clearInterval(leaseTimer);
  watcher.close(); await watcherTask.catch(() => undefined);
  for (const id of [...clients.keys()]) await detachLease(id);
  await server.shutdown().catch(() => undefined);
  await Deno.remove(desktopFile).catch(() => undefined);
  await lock.close();
  await Deno.remove(lockFile).catch(() => undefined);
  Deno.exit(0);
}

addEventListener("unload", () => { void shutdown(); });
