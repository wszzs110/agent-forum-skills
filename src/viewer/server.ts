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

function renderItem(item: TimelineItem, timeline: TimelineItem[], snapshot: ForumSnapshot): string {
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const profile = snapshot.members[actorId];
  const actor = profile?.displayName ?? actorId;
  let content: string;
  if (item.kind === "message") {
    const parent = item.replyTo ? timeline.find((candidate) => candidate.kind === "message" && candidate.id === item.replyTo) : undefined;
    const reply = item.replyTo
      ? parent && parent.kind === "message"
        ? `<div class="reply">Reply to ${escapeHtml(snapshot.members[parent.authorId]?.displayName ?? parent.authorId)}: ${escapeHtml(parent.body.slice(0, 160))}</div>`
        : `<div class="reply missing">Reply target unavailable: ${escapeHtml(item.replyTo)}</div>`
      : "";
    const mentions = item.mentions.length ? `<div class="chips">Mentions: ${item.mentions.map((id) => `<code>${escapeHtml(snapshot.members[id]?.displayName ?? id)}</code>`).join(" ")}</div>` : "";
    const references = item.references.length ? `<div class="chips">References: ${item.references.map((reference) => `<code>${escapeHtml(reference.kind)}=${escapeHtml(reference.value)}</code>`).join(" ")}</div>` : "";
    content = `${reply}<div class="body">${escapeHtml(item.body)}</div>${mentions}${references}`;
  } else {
    content = `<div class="body">${escapeHtml(item.reason)}</div><div class="chips">${escapeHtml(JSON.stringify(item.data))}</div>`;
  }
  const correction = `Please review and correct Agent Forum item ${item.id} in room ${item.kind === "message" ? item.threadId : "event"}. Preserve history and publish a new correction or event.`;
  return `<article class="item ${item.kind}"><header><span class="type">${escapeHtml(item.type)}</span><span>${escapeHtml(actor)}${profile ? ` · ${escapeHtml(profile.role)}` : ""}</span><time>${escapeHtml(item.createdAt)}</time></header>${content}<footer><code>${escapeHtml(item.id)}</code> <button class="copy" data-copy="${escapeHtml(item.id)}">Copy ID</button> <button class="copy" data-copy="${escapeHtml(correction)}">Copy correction prompt</button></footer></article>`;
}

export function renderViewerHtml(snapshot: ForumSnapshot, room: CachedRoom): string {
  const threads = room.threads.map(({ thread, timeline }) => {
    const creator = snapshot.members[thread.createdBy]?.displayName ?? thread.createdBy;
    return `<section class="thread"><h2>${escapeHtml(thread.title)}</h2><div class="meta"><strong>${escapeHtml(thread.kind)}</strong> · ${escapeHtml(thread.status)} · created by ${escapeHtml(creator)} at ${escapeHtml(thread.createdAt)} · ${timeline.length} timeline items · last ${escapeHtml(thread.lastActivityAt)}</div><button class="copy" data-copy="${escapeHtml(thread.id)}">Copy thread ID</button>${timeline.map((item) => renderItem(item, timeline, snapshot)).join("")}</section>`;
  }).join("");
  const roomEvents = room.events.length
    ? `<section class="thread"><h2>Room events</h2>${room.events.map((event) => renderItem(event, room.events, snapshot)).join("")}</section>`
    : "";
  const activeMembers = Object.entries(room.members ?? {}).filter(([, membership]) => membership.status === "active").map(([id, membership]) => `<li>${escapeHtml(snapshot.members[id]?.displayName ?? id)} — ${escapeHtml(membership.role)} — ${escapeHtml(membership.responsibility)}</li>`).join("");
  const warnings = snapshot.warnings.length
    ? `<aside class="warnings"><h2>Protocol warnings</h2>${snapshot.warnings.map((warning) => `<p><strong>${escapeHtml(warning.code)}</strong> ${escapeHtml(warning.path)} — ${escapeHtml(warning.message)}</p>`).join("")}</aside>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} — Agent Forum</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:auto;padding:24px;background:#f6f7f9;color:#1d2433}h1{margin-bottom:4px}.meta,code,time{color:#667085;font-size:13px}.thread{background:#fff;border:1px solid #dfe3ea;border-radius:10px;padding:18px;margin:18px 0}.item{border-left:3px solid #7c8db5;padding:10px 14px;margin:12px 0;background:#fafbfc}.event{border-color:#b7791f}.item header{display:flex;gap:12px;flex-wrap:wrap}.type{font-weight:700}.body{white-space:pre-wrap;margin:8px 0}.reply{font-size:13px;color:#475467;background:#eef2f6;padding:7px}.missing{color:#9b2c2c}.chips{font-size:13px;margin:6px 0}.warnings{background:#fff4e5;border:1px solid #f0b45a;padding:14px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px}button{padding:5px 9px}footer{margin-top:8px}.notice{background:#e8f2ff;padding:10px}</style></head><body><div class="toolbar"><div><h1>${escapeHtml(room.room.title)}</h1><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} · ${escapeHtml(room.room.status)} · cache ${escapeHtml(snapshot.sourceHead.slice(0, 12))} · generated ${escapeHtml(snapshot.generatedAt)}</div></div><button id="close">Close viewer</button></div><p>${escapeHtml(room.room.description)}</p><p class="notice">Read-only view. Return to your Agent conversation to request corrections; history is never edited here.</p><button class="copy" data-copy="${escapeHtml(room.room.id)}">Copy room ID</button>${activeMembers ? `<details><summary>Active members</summary><ul>${activeMembers}</ul></details>` : ""}${warnings}${roomEvents}${threads || "<p>No threads.</p>"}<script nonce="agent-forum">const revision=${JSON.stringify(snapshot.sourceHead)};document.querySelectorAll('.copy').forEach(button=>button.addEventListener('click',()=>navigator.clipboard.writeText(button.dataset.copy||'')));document.getElementById('close').addEventListener('click',async()=>{try{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<p>Viewer closed.</p>'}catch{}});if(location.protocol==='http:')setInterval(async()=>{try{const next=await(await fetch(location.pathname+'revision')).json();if(next.revision!==revision)location.reload()}catch{}},2000)</script></body></html>`;
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
