import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { CachedRoom, ForumSnapshot, TimelineItem } from "../services/timeline-cache.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function biHtml(en: string, zh: string): string {
  return `<span class="lang-en">${en}</span><span class="lang-zh" style="display:none">${zh}</span>`;
}

function biText(en: string, zh: string): string {
  return biHtml(escapeHtml(en), escapeHtml(zh));
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "blocker":
    case "objection":
      return "t-danger";
    case "decision":
    case "answer":
    case "acknowledgement":
      return "t-success";
    case "proposal":
    case "review":
      return "t-violet";
    case "status":
    case "test-result":
    case "correction":
      return "t-neutral";
    default:
      return "t-default";
  }
}

function renderItem(item: TimelineItem, timeline: TimelineItem[], snapshot: ForumSnapshot): string {
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const profile = snapshot.members[actorId];
  const actor = profile?.displayName ?? actorId;
  const badge = item.kind === "event" ? "t-event" : typeBadgeClass(item.type);
  let content: string;
  if (item.kind === "message") {
    const parent = item.replyTo ? timeline.find((candidate) => candidate.kind === "message" && candidate.id === item.replyTo) : undefined;
    const reply = item.replyTo
      ? parent && parent.kind === "message"
        ? `<div class="reply">${biText("Reply to", "回复")}${escapeHtml(" ")}${escapeHtml(snapshot.members[parent.authorId]?.displayName ?? parent.authorId)}${escapeHtml(": ")}${escapeHtml(parent.body.slice(0, 160))}</div>`
        : `<div class="reply missing">${biText("Reply target unavailable:", "回复目标不可用：")}${escapeHtml(" ")}${escapeHtml(item.replyTo)}</div>`
      : "";
    const mentions = item.mentions.length ? `<div class="chips">${biText("Mentions:", "提及：")}${escapeHtml(" ")}${item.mentions.map((id) => `<code>${escapeHtml(snapshot.members[id]?.displayName ?? id)}</code>`).join(" ")}</div>` : "";
    const references = item.references.length ? `<div class="chips">${biText("References:", "引用：")}${escapeHtml(" ")}${item.references.map((reference) => `<code>${escapeHtml(reference.kind)}=${escapeHtml(reference.value)}</code>`).join(" ")}</div>` : "";
    content = `${reply}<div class="body">${escapeHtml(item.body)}</div>${mentions}${references}`;
  } else {
    content = `<div class="body">${escapeHtml(item.reason)}</div><div class="chips">${escapeHtml(JSON.stringify(item.data))}</div>`;
  }
  const roomRef = item.kind === "message" ? item.threadId : "event";
  const correctionEn = `Please review and correct Agent Forum item ${item.id} in room ${roomRef}. Preserve history and publish a new correction or event.`;
  const correctionZh = `请审查并纠正 Agent Forum 中的条目 ${item.id}（Room: ${roomRef}）。保留历史，发布新的纠正消息或事件。`;
  return `<article class="item ${item.kind}"><header><span class="type ${badge}">${escapeHtml(item.type)}</span><span class="actor">${escapeHtml(actor)}${profile ? ` <span class="role">${escapeHtml(profile.role)}</span>` : ""}</span><time>${escapeHtml(item.createdAt)}</time></header>${content}<footer><code>${escapeHtml(item.id)}</code><button class="copy btn-sm" data-copy="${escapeHtml(item.id)}" data-copy-en="${escapeHtml(item.id)}" data-copy-zh="${escapeHtml(item.id)}" data-en="Copy ID" data-zh="复制 ID">${escapeHtml("Copy ID")}</button><button class="copy btn-sm" data-copy="${escapeHtml(correctionEn)}" data-copy-en="${escapeHtml(correctionEn)}" data-copy-zh="${escapeHtml(correctionZh)}" data-en="Copy correction prompt" data-zh="复制纠正提示">${escapeHtml("Copy correction prompt")}</button></footer></article>`;
}

export function renderViewerHtml(snapshot: ForumSnapshot, room: CachedRoom): string {
  const threads = room.threads.map(({ thread, timeline }) => {
    const creator = snapshot.members[thread.createdBy]?.displayName ?? thread.createdBy;
    const metaEn = `<strong>${escapeHtml(thread.kind)}</strong> · ${escapeHtml(thread.status)} · created by ${escapeHtml(creator)} at ${escapeHtml(thread.createdAt)} · ${timeline.length} timeline items · last ${escapeHtml(thread.lastActivityAt)}`;
    const metaZh = `<strong>${escapeHtml(thread.kind)}</strong> · ${escapeHtml(thread.status)} · 由 ${escapeHtml(creator)} 创建于 ${escapeHtml(thread.createdAt)} · ${timeline.length} 条时间线 · 最后 ${escapeHtml(thread.lastActivityAt)}`;
    return `<section class="thread"><div class="thread-head"><h2>${escapeHtml(thread.title)}</h2><div class="meta">${biHtml(metaEn, metaZh)}</div></div><div class="thread-body"><button class="copy btn-sm" data-copy="${escapeHtml(thread.id)}" data-copy-en="${escapeHtml(thread.id)}" data-copy-zh="${escapeHtml(thread.id)}" data-en="Copy thread ID" data-zh="复制 Thread ID">${escapeHtml("Copy thread ID")}</button>${timeline.map((item) => renderItem(item, timeline, snapshot)).join("")}</div></section>`;
  }).join("");
  const roomEvents = room.events.length
    ? `<section class="thread"><div class="thread-head"><h2>${biText("Room events", "Room 事件")}</h2></div><div class="thread-body">${room.events.map((event) => renderItem(event, room.events, snapshot)).join("")}</div></section>`
    : "";
  const activeMembers = Object.entries(room.members ?? {}).filter(([, membership]) => membership.status === "active").map(([id, membership]) => `<li>${escapeHtml(snapshot.members[id]?.displayName ?? id)} <span class="role">${escapeHtml(membership.role)}</span> · ${escapeHtml(membership.responsibility)}</li>`).join("");
  const warnings = snapshot.warnings.length
    ? `<aside class="warnings"><h2>${biText("Protocol warnings", "协议警告")}</h2>${snapshot.warnings.map((warning) => `<p><strong>${escapeHtml(warning.code)}</strong> ${escapeHtml(warning.path)} — ${escapeHtml(warning.message)}</p>`).join("")}</aside>`
    : "";
  const noThreads = biText("No threads.", "没有 Thread。");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} — Agent Forum</title><style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:920px;margin:0 auto;padding:0;background:#f0f2f5;color:#1d2433;line-height:1.6}.wrap{padding:24px 20px 60px}h1{margin:0 0 4px;font-size:22px;font-weight:700}.meta{color:#667085;font-size:12px;margin:0}.meta code{background:#f1f3f5;padding:1px 5px;border-radius:4px;font-size:11px}code{font-family:ui-monospace,'SF Mono',Consolas,monospace}time{color:#94a3b8;font-size:11px}.thread{background:#fff;border:1px solid #e4e7ec;border-radius:12px;margin:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}.thread-head{padding:14px 20px;border-bottom:1px solid #f0f1f3}.thread-head h2{margin:0 0 4px;font-size:16px;font-weight:600}.thread-body{padding:6px 20px 14px}.item{border-left:3px solid #6366f1;padding:12px 16px;margin:10px 0;background:#fbfbfc;border-radius:0 8px 8px 0;transition:background .15s,box-shadow .15s}.item:hover{background:#f5f7fa;box-shadow:0 1px 2px rgba(0,0,0,.04)}.event{border-color:#d97706}.item>header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.type{font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:20px;display:inline-block}.t-default{background:#dbeafe;color:#1e40af}.t-event{background:#fef3c7;color:#92400e}.t-danger{background:#fee2e2;color:#991b1b}.t-success{background:#d1fae5;color:#065f46}.t-violet{background:#ede9fe;color:#5b21b6}.t-neutral{background:#f1f5f9;color:#475569}.actor{font-size:13px;color:#334155}.role{color:#94a3b8;font-size:12px;margin-left:2px}.item time{margin-left:auto}.body{white-space:pre-wrap;margin:8px 0;font-size:14px;line-height:1.65}.reply{font-size:13px;color:#64748b;background:#f1f5f9;padding:8px 12px;border-radius:8px;margin-bottom:8px;border-left:2px solid #cbd5e1}.reply.missing{color:#b91c1c;background:#fef2f2;border-color:#fca5a5}.chips{font-size:12px;margin:6px 0;color:#64748b}.chips code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px}.item>footer{margin-top:10px;padding-top:8px;border-top:1px solid #f0f1f3;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.item>footer>code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;color:#94a3b8}.warnings{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px 20px;margin:14px 0}.warnings h2{font-size:14px;color:#92400e;margin:0 0 8px}.warnings p{margin:4px 0;font-size:13px;color:#78350f}.toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap}.toolbar-right{display:flex;gap:8px}button{padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;cursor:pointer;transition:all .15s}button:hover{border-color:#6366f1;color:#6366f1}#close:hover{background:#ef4444;border-color:#ef4444;color:#fff}.btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}.notice{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:12px 0;font-size:13px;color:#1e40af}details{margin:12px 0}summary{cursor:pointer;font-size:13px;font-weight:500;padding:8px 12px;background:#fff;border:1px solid #e4e7ec;border-radius:8px;transition:all .15s}summary:hover{border-color:#6366f1}details ul{list-style:none;padding:8px 0 0;margin:0}details li{padding:3px 12px;font-size:13px;color:#64748b}.lang-zh{display:none}</style></head><body><div class="wrap"><div class="toolbar"><div><h1>${escapeHtml(room.room.title)}</h1><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} · ${escapeHtml(room.room.status)} · cache ${escapeHtml(snapshot.sourceHead.slice(0, 12))} · generated ${escapeHtml(snapshot.generatedAt)}</div></div><div class="toolbar-right"><button id="lang-toggle">中文</button><button id="close">Close viewer</button></div></div><p>${escapeHtml(room.room.description)}</p><p class="notice">${biText("Read-only view. Return to your Agent conversation to request corrections; history is never edited here.", "只读视图。如需纠正，请回到 Agent 会话提出；此处不会修改历史。")}</p><button class="copy btn-sm" data-copy="${escapeHtml(room.room.id)}" data-copy-en="${escapeHtml(room.room.id)}" data-copy-zh="${escapeHtml(room.room.id)}" data-en="Copy room ID" data-zh="复制 Room ID">${escapeHtml("Copy room ID")}</button>${activeMembers ? `<details><summary>${biText("Active members", "活跃成员")}</summary><ul>${activeMembers}</ul></details>` : ""}${warnings}${roomEvents}${threads || `<p>${noThreads}</p>`}<script nonce="agent-forum">let lang=navigator.language.startsWith('zh')?'zh':'en';function applyLang(){document.querySelectorAll('.lang-en').forEach(e=>e.style.display=lang==='en'?'':'none');document.querySelectorAll('.lang-zh').forEach(e=>e.style.display=lang==='zh'?'':'none');document.querySelectorAll('[data-en][data-zh]').forEach(e=>e.textContent=lang==='en'?e.dataset.en:e.dataset.zh);document.querySelectorAll('[data-copy-en]').forEach(e=>e.dataset.copy=lang==='en'?e.dataset.copyEn:e.dataset.copyZh);document.getElementById('lang-toggle').textContent=lang==='en'?'中文':'EN';}applyLang();document.getElementById('lang-toggle').addEventListener('click',()=>{lang=lang==='en'?'zh':'en';applyLang()});document.querySelectorAll('.copy').forEach(button=>button.addEventListener('click',()=>navigator.clipboard.writeText(button.dataset.copy||'')));document.getElementById('close').addEventListener('click',async()=>{try{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<div class="wrap"><p>Viewer closed.</p></div>'}catch{}});if(location.protocol==='http:')setInterval(async()=>{try{const next=await(await fetch(location.pathname+'revision')).json();if(next.revision!==revision)location.reload()}catch{}},2000)</script></div></body></html>`;
}

export interface ViewerHandle {
  url: string;
  token: string;
  port: number;
  updateSnapshot: (snapshot: ForumSnapshot) => void;
  closed: Promise<void>;
  close: () => Promise<void>;
}

export async function startViewerServer(input: {
  snapshot: ForumSnapshot;
  roomIdOrSlug: string;
  idleMs?: number;
  token?: string;
}): Promise<ViewerHandle> {
  const room = input.snapshot.rooms.find(
    (candidate) =>
      candidate.room.id === input.roomIdOrSlug ||
      candidate.room.slug === input.roomIdOrSlug,
  );
  if (!room) throw new Error(`room was not found in snapshot: ${input.roomIdOrSlug}`);
  const token = input.token ?? randomBytes(16).toString("hex");
  const basePath = `/session/${token}/`;
  let currentSnapshot = input.snapshot;
  let currentRoom = room;
  let html = renderViewerHtml(currentSnapshot, currentRoom);
  let revision = currentSnapshot.sourceHead;
  const idleMs = input.idleMs ?? 5 * 60_000;
  let timer: NodeJS.Timeout;
  let server: Server;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolveValue) => { resolveClosed = resolveValue; });
  let closing: Promise<void> | undefined;
  const close = () => {
    if (closing) return closing;
    closing = new Promise<void>((resolveClose) => {
      clearTimeout(timer);
      server.close(() => {
        resolveClosed();
        resolveClose();
      });
    });
    return closing;
  };
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void close(), idleMs);
    timer.unref();
  };
  server = createServer((request, response) => {
    touch();
    response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-agent-forum'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && request.url === basePath) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (request.method === "GET" && request.url === `${basePath}revision`) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ revision }));
      return;
    }
    if (request.method === "POST" && request.url === `${basePath}close`) {
      response.writeHead(204);
      response.end();
      setImmediate(() => void close());
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  touch();
  const address = server.address();
  if (!address || typeof address === "string") {
    await close();
    throw new Error("viewer did not receive a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}${basePath}`,
    token,
    port: address.port,
    closed,
    updateSnapshot: (snapshot) => {
      const nextRoom = snapshot.rooms.find(
        (candidate) => candidate.room.id === room.room.id,
      );
      if (!nextRoom) return;
      currentSnapshot = snapshot;
      currentRoom = nextRoom;
      revision = snapshot.sourceHead;
      html = renderViewerHtml(currentSnapshot, currentRoom);
    },
    close,
  };
}
