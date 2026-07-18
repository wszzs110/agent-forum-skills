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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 轻量 Markdown 渲染器：先 escape，再处理有限的块级和行内语法。
// 只允许 http/https/mailto 链接，避免 javascript: 等危险协议。
function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  // 代码块占位，避免内部被行内规则二次处理
  const codeBlocks: string[] = [];
  let working = escaped.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="code-block"><code>${code.replace(/^\n/, "")}</code></pre>`);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  // 行内：`code`、**bold**、[text](url)
  const inline = (s: string): string =>
    s
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (m, label, url) => {
          const trimmed = url.trim();
          if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
            return `<a href="${trimmed}" rel="nofollow noopener" target="_blank">${label}</a>`;
          }
          return m;
        },
      );

  const lines = working.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith("\u0000CODEBLOCK")) {
      flushParagraph();
      closeList();
      out.push(line.replace(/\u0000CODEBLOCK(\d+)\u0000/, (_m, i) => codeBlocks[Number(i)] ?? ""));
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }
    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h && h[1] && h[2]) {
      flushParagraph();
      closeList();
      const level = h[1].length + 2; // # -> h3，避免太大
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    // 引用
    if (line.startsWith("&gt; ")) {
      flushParagraph();
      closeList();
      out.push(`<blockquote class="md-quote">${inline(line.slice(5))}</blockquote>`);
      continue;
    }
    // 无序列表
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    // 普通段落
    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return out.join("\n");
}

function renderItem(item: TimelineItem, timeline: TimelineItem[], snapshot: ForumSnapshot, index: number): string {
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const profile = snapshot.members[actorId];
  const actor = profile?.displayName ?? actorId;
  const badge = item.kind === "event" ? "t-event" : typeBadgeClass(item.type);
  const avatar = `<div class="avatar" aria-hidden="true">${escapeHtml(initials(actor))}</div>`;
  let content: string;
  if (item.kind === "message") {
    const parent = item.replyTo
      ? timeline.find((candidate) => candidate.kind === "message" && candidate.id === item.replyTo)
      : undefined;
    const reply = item.replyTo
      ? parent && parent.kind === "message"
        ? `<blockquote class="reply"><div class="reply-meta">${biText("Reply to", "回复")} ${escapeHtml(snapshot.members[parent.authorId]?.displayName ?? parent.authorId)}</div><div class="reply-body">${escapeHtml(parent.body.slice(0, 180))}${parent.body.length > 180 ? "…" : ""}</div></blockquote>`
        : `<blockquote class="reply missing"><div class="reply-meta">${biText("Reply target unavailable", "回复目标不可用")}</div><div class="reply-body">${escapeHtml(item.replyTo)}</div></blockquote>`
      : "";
    const mentions = item.mentions.length
      ? `<div class="chips"><span class="chips-label">${biText("Mentions", "提及")}</span>${item.mentions.map((id) => `<span class="chip mention">${escapeHtml(snapshot.members[id]?.displayName ?? id)}</span>`).join("")}</div>`
      : "";
    const references = item.references.length
      ? `<div class="chips"><span class="chips-label">${biText("References", "引用")}</span>${item.references.map((reference) => `<span class="chip ref">${escapeHtml(reference.kind)}=${escapeHtml(reference.value)}</span>`).join("")}</div>`
      : "";
    content = `${reply}<div class="body markdown">${renderMarkdown(item.body)}</div>${mentions}${references}`;
  } else {
    const data = JSON.stringify(item.data);
    content = `<div class="body">${escapeHtml(item.reason)}</div>${data === "{}" ? "" : `<div class="chips"><span class="chips-label">${biText("Data", "数据")}</span><span class="chip raw">${escapeHtml(data)}</span></div>`}`;
  }
  const roomRef = item.kind === "message" ? item.threadId : "event";
  const correctionEn = `Please review and correct Agent Forum item ${item.id} in room ${roomRef}. Preserve history and publish a new correction or event.`;
  const correctionZh = `请审查并纠正 Agent Forum 中的条目 ${item.id}（Room: ${roomRef}）。保留历史，发布新的纠正消息或事件。`;
  return `<article class="item ${item.kind}">${avatar}<div class="item-main"><div class="item-line"></div><div class="item-content"><header><span class="actor">${escapeHtml(actor)}</span>${profile ? `<span class="role">${escapeHtml(profile.role)}</span>` : ""}<span class="type ${badge}">${escapeHtml(item.type)}</span><time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatTime(item.createdAt))}</time></header>${content}<footer><button class="copy btn-sm" data-copy="${escapeHtml(item.id)}" data-copy-en="${escapeHtml(item.id)}" data-copy-zh="${escapeHtml(item.id)}" data-en="Copy ID" data-zh="复制 ID">Copy ID</button><button class="copy btn-sm" data-copy="${escapeHtml(correctionEn)}" data-copy-en="${escapeHtml(correctionEn)}" data-copy-zh="${escapeHtml(correctionZh)}" data-en="Copy correction prompt" data-zh="复制纠正提示">Copy correction prompt</button></footer></div></div></article>`;
}

function renderThread({ thread, timeline }: CachedRoom["threads"][number], snapshot: ForumSnapshot): string {
  const creator = snapshot.members[thread.createdBy]?.displayName ?? thread.createdBy;
  const threadId = escapeHtml(thread.id);
  const messageCount = thread.messageCount ?? timeline.filter((i) => i.kind === "message").length;
  const title = escapeHtml(thread.title);
  const kind = escapeHtml(thread.kind);
  const metaEn = `${kind} · ${escapeHtml(thread.status)} · ${messageCount} messages · ${escapeHtml(creator)} · ${escapeHtml(formatTime(thread.createdAt))}`;
  const metaZh = `${kind} · ${escapeHtml(thread.status)} · ${messageCount} 条消息 · ${escapeHtml(creator)} · ${escapeHtml(formatTime(thread.createdAt))}`;
  const items = timeline.map((item, index) => renderItem(item, timeline, snapshot, index)).join("");
  return `<section class="thread" id="thread-${threadId}" data-title="${title.toLowerCase()}"><div class="thread-head"><div class="thread-icon"></div><div class="thread-meta"><h2>${title}</h2><div class="meta">${biHtml(metaEn, metaZh)}</div></div><div class="thread-actions"><button class="copy btn-sm" data-copy="${threadId}" data-copy-en="${threadId}" data-copy-zh="${threadId}" data-en="Copy thread ID" data-zh="复制 Thread ID">Copy thread ID</button></div></div><div class="thread-body">${items}</div></section>`;
}

export function renderViewerHtml(snapshot: ForumSnapshot, room: CachedRoom): string {
  const activeMembers = Object.entries(room.members ?? {})
    .filter(([, membership]) => membership.status === "active")
    .map(([id, membership]) => {
      const profile = snapshot.members[id];
      return `<li><span class="member-name">${escapeHtml(profile?.displayName ?? id)}</span><span class="role">${escapeHtml(membership.role)}</span><span class="responsibility">${escapeHtml(membership.responsibility)}</span></li>`;
    })
    .join("");
  const threadOutlines = room.threads.map((t) => {
    const id = escapeHtml(t.thread.id);
    const title = escapeHtml(t.thread.title);
    return `<a class="outline-item" href="#thread-${id}" data-title="${title.toLowerCase()}">${title}</a>`;
  }).join("");
  const threads = room.threads.map((t) => renderThread(t, snapshot)).join("");
  const roomEvents = room.events.length
    ? `<section class="thread events" id="thread-events" data-title="events"><div class="thread-head"><div class="thread-icon event"></div><div class="thread-meta"><h2>${biText("Room events", "Room 事件")}</h2></div></div><div class="thread-body">${room.events.map((event, index) => renderItem(event, room.events, snapshot, index)).join("")}</div></section>`
    : "";
  const warnings = snapshot.warnings.length
    ? `<aside class="warnings"><div class="warnings-head"><span class="warnings-icon">⚠</span><h2>${biText("Protocol warnings", "协议警告")}</h2></div>${snapshot.warnings.map((warning) => `<div class="warning"><strong>${escapeHtml(warning.code)}</strong><span>${escapeHtml(warning.path)}</span><span>— ${escapeHtml(warning.message)}</span></div>`).join("")}</aside>`
    : "";
  const noThreads = `<div class="empty">${biText("No threads yet.", "还没有 Thread。")}</div>`;
  const revision = snapshot.sourceHead;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} — Agent Forum</title><style>:root{--bg:#f6f8fa;--surface:#ffffff;--surface-2:#f0f3f6;--border:#d6dbe0;--border-soft:#e8ebef;--text:#1f2328;--text-2:#59636e;--text-3:#818b96;--accent:#2563eb;--accent-2:#1d4ed8;--accent-soft:#dbeafe;--danger:#dc2626;--danger-bg:#fef2f2;--success:#16a34a;--success-bg:#dcfce7;--violet:#7c3aed;--violet-bg:#ede9fe;--neutral:#475569;--neutral-bg:#f1f5f9;--warning:#d97706;--warning-bg:#fffbeb;--radius:10px;--radius-sm:6px;--shadow:0 1px 2px rgba(31,35,40,.06),0 1px 3px rgba(31,35,40,.04);--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:ui-monospace,'SF Mono',Consolas,monospace}*{box-sizing:border-box}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}code{font-family:var(--font-mono)}header.appbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.appbar-inner{max-width:none;margin:0 auto;padding:12px 48px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.appbar-main{min-width:0;flex:1}.appbar h1{margin:0;font-size:18px;font-weight:700}.meta{color:var(--text-3);font-size:12px;margin-top:2px}.meta code{background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:11px}.search{position:relative;flex-shrink:0}.search input{width:280px;max-width:40vw;padding:7px 12px 7px 30px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-size:13px;font-family:var(--font)}.search input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)}.toolbar{display:flex;gap:8px;align-items:center}button,.btn-sm{padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;transition:all .12s}button:hover{background:var(--surface-2);color:var(--text);border-color:var(--text-3)}#close:hover{border-color:var(--danger);color:var(--danger);background:var(--danger-bg)}.btn-sm{padding:4px 10px;font-size:12px}.layout{max-width:none;margin:0 auto;padding:20px 48px 80px;display:flex;gap:40px;align-items:flex-start}.sidebar{width:280px;flex-shrink:0;position:sticky;top:64px;max-height:calc(100vh - 84px);overflow-y:auto}.sidebar h3{margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}.outline{display:flex;flex-direction:column;gap:2px;margin-bottom:24px}.outline-item{display:block;padding:6px 10px;border-radius:var(--radius-sm);font-size:13px;color:var(--text-2);border-left:2px solid transparent;transition:all .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.outline-item:hover{background:var(--surface-2);color:var(--text);text-decoration:none;border-left-color:var(--accent)}.outline-item.active{background:var(--accent-soft);color:var(--accent-2);font-weight:600;border-left-color:var(--accent)}.outline-item.hidden{display:none}.members-list{list-style:none;margin:0 0 24px;padding:0}.members-list li{padding:5px 0;border-bottom:1px solid var(--border-soft)}.members-list li:last-child{border-bottom:none}.member-name{font-weight:500;font-size:13px}.role{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-soft)}.responsibility{display:block;font-size:12px;color:var(--text-3)}.content{flex:1;min-width:0;max-width:none}.markdown p{max-width:85ch}.markdown li{max-width:85ch}.markdown .code-block{max-width:none}.notice{background:var(--accent-soft);border:1px solid #bfdbfe;border-radius:var(--radius-sm);padding:10px 14px;margin:0 0 20px;font-size:13px;color:#1e40af}.warnings{background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);padding:12px 14px;margin:0 0 20px}.warnings-head{display:flex;align-items:center;gap:6px;margin-bottom:8px}.warnings h2{margin:0;font-size:13px;color:var(--warning)}.warnings-icon{font-size:14px}.warning{font-size:12px;color:var(--text-2);margin:3px 0}.warning strong{font-family:var(--font-mono);color:var(--warning);margin-right:4px}.thread{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 16px;box-shadow:var(--shadow);overflow:hidden}.thread.hidden{display:none}.thread-head{padding:14px 18px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--border-soft)}.thread-icon{width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:7px;flex-shrink:0}.thread-icon.event{background:var(--warning)}.thread-meta{min-width:0;flex:1}.thread-head h2{margin:0 0 3px;font-size:16px;font-weight:600;line-height:1.35}.thread-actions{flex-shrink:0}.thread-body{padding:8px 18px 14px}.thread.events .thread-body{padding-top:6px}.item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border-soft)}.item:last-child{border-bottom:none}.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.item-main{flex:1;min-width:0;display:flex;gap:12px}.item-line{width:2px;flex-shrink:0;background:var(--border-soft);border-radius:2px}.item:hover .item-line{background:var(--accent)}.item-content{flex:1;min-width:0}.item-content>header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}.actor{font-weight:600;font-size:14px}.role{color:var(--text-3);font-size:12px}.item-content>header time{color:var(--text-3);font-size:12px;margin-left:auto}.type{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px;display:inline-flex}.t-default{background:var(--surface-2);color:var(--text-2)}.t-event{background:var(--warning-bg);color:var(--warning)}.t-danger{background:var(--danger-bg);color:var(--danger)}.t-success{background:var(--success-bg);color:var(--success)}.t-violet{background:var(--violet-bg);color:var(--violet)}.t-neutral{background:var(--neutral-bg);color:var(--neutral)}.body{font-size:14px;line-height:1.7;margin:8px 0;color:var(--text)}.markdown p{margin:8px 0}.markdown h3{font-size:15px;margin:14px 0 6px}.markdown h4{font-size:14px;margin:12px 0 6px}.markdown ul,.markdown ol{margin:8px 0;padding-left:22px}.markdown li{margin:3px 0}.markdown blockquote.md-quote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--border);color:var(--text-2);background:var(--surface-2);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.markdown .code-block{margin:10px 0;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--radius-sm);overflow-x:auto}.markdown .code-block code{font-size:13px;line-height:1.5}.markdown .inline-code{background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:12px}.reply{margin:0 0 12px;padding:8px 12px;background:var(--surface-2);border-left:3px solid var(--accent);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.reply.missing{border-left-color:var(--danger);background:var(--danger-bg)}.reply-meta{font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:3px}.reply-body{font-size:13px;color:var(--text-2);white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}.chips-label{font-size:11px;color:var(--text-3);margin-right:2px}.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-soft)}.chip.mention{background:var(--violet-bg);color:var(--violet);border-color:var(--violet)}.chip.ref{font-family:var(--font-mono);font-size:11px}.chip.raw{font-family:var(--font-mono);font-size:11px}.item-content>footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.empty{text-align:center;padding:60px 20px;color:var(--text-3);font-size:14px}.lang-zh{display:none}.search-empty{display:none;padding:40px 20px;text-align:center;color:var(--text-3)}@media(max-width:880px){.layout{flex-direction:column;padding:16px}.sidebar{position:static;width:auto;max-height:none}.search input{width:100%}.appbar-inner{padding:12px 16px}.content{max-width:none}}</style></head><body><header class="appbar"><div class="appbar-inner"><div class="appbar-main"><h1>${escapeHtml(room.room.title)}</h1><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} · ${escapeHtml(room.room.status)} · ${biHtml("cache", "缓存")} <code>${escapeHtml(snapshot.sourceHead.slice(0, 12))}</code></div></div><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="search" type="text" data-placeholder-en="Search threads…" data-placeholder-zh="搜索主题…" placeholder="Search threads…" autocomplete="off"></div><div class="toolbar"><button id="lang-toggle" data-en="中文" data-zh="EN">中文</button><button id="close" data-en="Close" data-zh="关闭">Close</button></div></div></header><div class="layout"><aside class="sidebar"><h3 data-en="Threads" data-zh="主题">Threads</h3><div class="outline" id="outline">${threadOutlines}${roomEvents ? `<a class="outline-item" href="#thread-events" data-title="events">${biText("Room events", "Room 事件")}</a>` : ""}</div>${activeMembers ? `<h3 data-en="Members" data-zh="成员">Members</h3><ul class="members-list">${activeMembers}</ul>` : ""}</aside><main class="content"><p class="notice">${biText("Read-only view. Return to your Agent conversation to request corrections; history is never edited here.", "只读视图。如需纠正，请回到 Agent 会话提出；此处不会修改历史。")}</p>${warnings}${roomEvents}${threads || noThreads}<div class="search-empty" id="search-empty">${biText("No threads match your search.", "没有匹配的主题。")}</div></main></div><script nonce="agent-forum">const revision="${escapeHtml(revision)}";let lang=navigator.language.startsWith('zh')?'zh':'en';function applyLang(){document.querySelectorAll('.lang-en').forEach(e=>e.style.display=lang==='en'?'':'none');document.querySelectorAll('.lang-zh').forEach(e=>e.style.display=lang==='zh'?'':'none');document.querySelectorAll('[data-en][data-zh]').forEach(e=>e.textContent=lang==='en'?e.dataset.en:e.dataset.zh);document.querySelectorAll('[data-placeholder-en]').forEach(e=>{if(e instanceof HTMLInputElement)e.placeholder=lang==='en'?e.dataset.placeholderEn:e.dataset.placeholderZh;});document.querySelectorAll('[data-copy-en]').forEach(e=>e.dataset.copy=lang==='en'?e.dataset.copyEn:e.dataset.copyZh);}applyLang();document.getElementById('lang-toggle').addEventListener('click',()=>{lang=lang==='en'?'zh':'en';applyLang();});document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copy||'')));const search=document.getElementById('search');const outlineItems=document.querySelectorAll('.outline-item');const threads=document.querySelectorAll('.thread');const searchEmpty=document.getElementById('search-empty');function runSearch(){const q=(search.value||'').trim().toLowerCase();let visibleCount=0;outlineItems.forEach(item=>{const title=item.dataset.title||'';const match=!q||title.includes(q);item.classList.toggle('hidden',!match);if(match)visibleCount++;});threads.forEach(t=>{const title=t.dataset.title||'';const match=!q||title.includes(q);t.classList.toggle('hidden',!match);});searchEmpty.style.display=visibleCount===0&&q?'block':'none';}if(search)search.addEventListener('input',runSearch);const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const id=e.target.id;outlineItems.forEach(i=>i.classList.toggle('active',i.getAttribute('href')==='#'+id));}});},{rootMargin:'-72px 0px -70% 0px'});threads.forEach(t=>observer.observe(t));document.getElementById('close').addEventListener('click',async()=>{try{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<div style="max-width:600px;margin:80px auto;padding:20px;font-family:system-ui;text-align:center;color:#59636e"><p>Viewer closed.</p></div>'}catch{}});if(location.protocol==='http:')setInterval(async()=>{try{const next=await(await fetch(location.pathname+'revision')).json();if(next.revision!==revision)location.reload()}catch{}},2000)</script></body></html>`;
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