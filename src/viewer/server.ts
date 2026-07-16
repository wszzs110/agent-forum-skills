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

function renderItem(item: TimelineItem, snapshot: ForumSnapshot): string {
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const actor = snapshot.members[actorId]?.displayName ?? actorId;
  const content = item.kind === "message"
    ? `<div class="body">${escapeHtml(item.body)}</div>${item.replyTo ? `<div class="reply">Reply to ${escapeHtml(item.replyTo)}</div>` : ""}`
    : `<div class="body">${escapeHtml(item.reason)}</div>`;
  return `<article class="item ${item.kind}"><header><span class="type">${escapeHtml(item.type)}</span><span>${escapeHtml(actor)}</span><time>${escapeHtml(item.createdAt)}</time></header>${content}<code>${escapeHtml(item.id)}</code></article>`;
}

function renderRoom(snapshot: ForumSnapshot, room: CachedRoom): string {
  const threads = room.threads
    .map(
      ({ thread, timeline }) =>
        `<section class="thread"><h2>${escapeHtml(thread.title)}</h2><div class="meta">${escapeHtml(thread.kind)} · ${escapeHtml(thread.status)} · ${timeline.length} timeline items</div>${timeline.map((item) => renderItem(item, snapshot)).join("")}</section>`,
    )
    .join("");
  const warnings = snapshot.warnings.length
    ? `<aside class="warnings"><h2>Protocol warnings</h2>${snapshot.warnings.map((warning) => `<p><strong>${escapeHtml(warning.code)}</strong> ${escapeHtml(warning.path)} — ${escapeHtml(warning.message)}</p>`).join("")}</aside>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} — Agent Forum</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:auto;padding:24px;background:#f6f7f9;color:#1d2433}h1{margin-bottom:4px}.meta,code,time{color:#667085;font-size:13px}.thread{background:#fff;border:1px solid #dfe3ea;border-radius:10px;padding:18px;margin:18px 0}.item{border-left:3px solid #7c8db5;padding:10px 14px;margin:12px 0;background:#fafbfc}.event{border-color:#b7791f}.item header{display:flex;gap:12px;flex-wrap:wrap}.type{font-weight:700}.body{white-space:pre-wrap;margin:8px 0}.reply{font-size:13px;color:#475467}.warnings{background:#fff4e5;border:1px solid #f0b45a;padding:14px}.toolbar{display:flex;justify-content:space-between;align-items:center}button{padding:7px 12px}</style></head><body><div class="toolbar"><div><h1>${escapeHtml(room.room.title)}</h1><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} · ${escapeHtml(room.room.status)} · cache ${escapeHtml(snapshot.sourceHead.slice(0, 12))}</div></div><button id="close">Close viewer</button></div><p>${escapeHtml(room.room.description)}</p>${warnings}${threads || "<p>No threads.</p>"}<script nonce="agent-forum">document.getElementById('close').addEventListener('click',async()=>{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<p>Viewer closed.</p>'})</script></body></html>`;
}

export interface ViewerHandle {
  url: string;
  token: string;
  port: number;
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
  const html = renderRoom(input.snapshot, room);
  const idleMs = input.idleMs ?? 5 * 60_000;
  let timer: NodeJS.Timeout;
  let server: Server;
  const close = () => new Promise<void>((resolveClose) => {
    clearTimeout(timer);
    server.close(() => resolveClose());
  });
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
    close,
  };
}
