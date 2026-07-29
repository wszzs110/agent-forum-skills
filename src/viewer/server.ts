import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { CachedRoom, ForumSnapshot, TimelineItem } from "../services/timeline-cache.js";

// Viewer 与静态导出共用内嵌 favicon，避免浏览器为 Tab 图标发起额外请求。
const viewerFavicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="b" x1="62" y1="40" x2="450" y2="472" gradientUnits="userSpaceOnUse"><stop stop-color="#151d2c"/><stop offset="1" stop-color="#080b12"/></linearGradient><linearGradient id="t" x1="118" y1="150" x2="394" y2="350" gradientUnits="userSpaceOnUse"><stop stop-color="#6b9fff"/><stop offset=".5" stop-color="#66c5e5"/><stop offset="1" stop-color="#70e1d0"/></linearGradient></defs><rect x="24" y="24" width="464" height="464" rx="112" fill="url(#b)"/><path d="M126 136v47c0 24 19 43 43 43h219M188 226v33c0 24 19 43 43 43h135M250 302v23c0 24 19 43 43 43h51" fill="none" stroke="url(#t)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`;

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
export function renderMarkdown(text: string): string {
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

  const tableCells = (line: string): string[] | undefined => {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return undefined;
    const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    return content.split("|").map((cell) => cell.trim());
  };
  const isTableDivider = (cells: readonly string[]): boolean =>
    cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
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
    // GFM pipe table：只在表头和分隔行都完整有效时输出表格。
    const header = tableCells(line);
    const divider = index + 1 < lines.length ? tableCells(lines[index + 1]!) : undefined;
    if (header && divider && header.length === divider.length && isTableDivider(divider)) {
      flushParagraph();
      closeList();
      const alignment = divider.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : undefined);
      const renderRow = (cells: readonly string[], tag: "th" | "td") => `<tr>${cells.map((cell, column) => `<${tag}${alignment[column] ? ` style="text-align:${alignment[column]}"` : ""}>${inline(cell)}</${tag}>`).join("")}</tr>`;
      const rows: string[] = [];
      let bodyIndex = index + 2;
      while (bodyIndex < lines.length) {
        const cells = tableCells(lines[bodyIndex]!);
        if (!cells || cells.length !== header.length) break;
        rows.push(renderRow(cells, "td"));
        bodyIndex += 1;
      }
      out.push(`<div class="md-table-wrap"><table class="md-table"><thead>${renderRow(header, "th")}</thead>${rows.length ? `<tbody>${rows.join("")}</tbody>` : ""}</table></div>`);
      index = bodyIndex - 1;
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

interface ReplyTreePlan {
  roots: string[];
  children: Map<string, string[]>;
  issues: Map<string, "missing-parent" | "cycle">;
}

// 回复树只是 Viewer 的派生视图，损坏或异常关系必须保守降级为根节点。
export function buildReplyTree(timeline: TimelineItem[]): ReplyTreePlan {
  const messages = timeline.filter((item): item is Extract<TimelineItem, { kind: "message" }> => item.kind === "message");
  const byId = new Map(messages.map((message) => [message.id, message]));
  const parentById = new Map<string, string>();
  const issues = new Map<string, "missing-parent" | "cycle">();
  for (const message of messages) {
    if (!message.replyTo) continue;
    if (!byId.has(message.replyTo)) {
      issues.set(message.id, "missing-parent");
      continue;
    }
    parentById.set(message.id, message.replyTo);
  }

  const cycleEdges = new Set<string>();
  for (const message of messages) {
    const visited = new Map<string, number>();
    let current = message.id;
    while (parentById.has(current)) {
      if (visited.has(current)) {
        const cycle = [...visited.keys()].slice(visited.get(current));
        for (const id of cycle) {
          cycleEdges.add(id);
          issues.set(id, "cycle");
        }
        break;
      }
      visited.set(current, visited.size);
      current = parentById.get(current)!;
    }
  }

  const children = new Map(messages.map((message) => [message.id, [] as string[]]));
  const roots: string[] = [];
  for (const message of messages) {
    const parentId = parentById.get(message.id);
    if (parentId && !cycleEdges.has(message.id)) children.get(parentId)?.push(message.id);
    else roots.push(message.id);
  }
  return { roots, children, issues };
}

function statusBadge(status: string, kind: "thread" | "room"): string {
  const normalized = status.toLowerCase();
  const known = normalized === "open" || normalized === "active" || normalized === "closed" || normalized === "archived";
  const css = known ? normalized : "unknown";
  const en = normalized === "open" ? "Open" : normalized === "active" ? "Active" : normalized === "closed" ? "Closed" : normalized === "archived" ? "Archived" : status;
  const zh = normalized === "open" ? "进行中" : normalized === "active" ? "活跃" : normalized === "closed" ? "已关闭" : normalized === "archived" ? "已归档" : status;
  return `<span class="status-badge ${kind}-status status-${escapeHtml(css)}">${biText(en, zh)}</span>`;
}

export interface ViewerReadIdentity {
  memberId: string;
  displayName: string;
  seenIds: string[];
}

function readBadge(item: TimelineItem, room: CachedRoom, identities: ViewerReadIdentity[]): string {
  if (identities.length === 0) return "";
  const actorId = item.kind === "message" ? item.authorId : item.actorId;
  const published = identities.filter((identity) => identity.memberId === actorId);
  const recipients = identities.filter((identity) => {
    if (identity.memberId === actorId) return false;
    const membership = room.members[identity.memberId];
    return membership?.status === "active" && typeof membership.updatedAt === "string" && item.createdAt >= membership.updatedAt;
  });
  const read = recipients.filter((identity) => identity.seenIds.includes(item.id));
  const names = (items: ViewerReadIdentity[]) => items.map((identity) => identity.displayName).join(", ");
  if (identities.length === 1) {
    if (published.length) return `<span class="read-badge published">${biText("AI published", "AI 发布")}</span>`;
    if (recipients.length === 0) return "";
    return read.length
      ? `<span class="read-badge read">${biText("AI read", "AI 已读")}</span>`
      : `<span class="read-badge unread">${biText("AI unread", "AI 未读")}</span>`;
  }
  const parts: string[] = [];
  if (published.length) parts.push(biText(`Published by ${names(published)}`, `${names(published)} 发布`));
  if (recipients.length) parts.push(biText(`${read.length}/${recipients.length} local AIs read`, `${read.length}/${recipients.length} 个本机 AI 已读`));
  return parts.length ? `<span class="read-badge ${recipients.length > read.length ? "unread" : published.length ? "published" : "read"}">${parts.join(" · ")}</span>` : "";
}

function renderItem(item: TimelineItem, timeline: TimelineItem[], snapshot: ForumSnapshot, room: CachedRoom, identities: ViewerReadIdentity[], index: number, treeIssue?: "missing-parent" | "cycle"): string {
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
  const replyAttributes = item.kind === "message"
    ? ` data-message-id="${escapeHtml(item.id)}" data-reply-to="${escapeHtml(item.replyTo ?? "")}"${treeIssue ? ` data-tree-issue="${treeIssue}"` : ""}`
    : "";
  const treeIssueNotice = treeIssue
    ? `<div class="tree-issue">${treeIssue === "cycle" ? biText("Reply cycle detected; shown as a separate branch.", "检测到回复循环；已作为独立分支显示。") : biText("Reply target unavailable; shown as a separate branch.", "回复目标不可用；已作为独立分支显示。")}</div>`
    : "";
  return `<article class="item ${item.kind}" data-timeline-index="${index}"${replyAttributes}>${avatar}<div class="item-main"><div class="item-line"></div><div class="item-content"><header><span class="actor">${escapeHtml(actor)}</span>${profile ? `<span class="role">${escapeHtml(profile.role)}</span>` : ""}<span class="type ${badge}">${escapeHtml(item.type)}</span>${readBadge(item, room, identities)}<time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatTime(item.createdAt))}</time></header>${content}${treeIssueNotice}<footer><button class="copy btn-sm" data-copy="${escapeHtml(item.id)}" data-copy-en="${escapeHtml(item.id)}" data-copy-zh="${escapeHtml(item.id)}" data-en="Copy ID" data-zh="复制 ID">Copy ID</button><button class="copy btn-sm" data-copy="${escapeHtml(correctionEn)}" data-copy-en="${escapeHtml(correctionEn)}" data-copy-zh="${escapeHtml(correctionZh)}" data-en="Copy correction prompt" data-zh="复制纠正提示">Copy correction prompt</button></footer></div></div></article>`;
}

function renderThread({ thread, timeline }: CachedRoom["threads"][number], snapshot: ForumSnapshot, room: CachedRoom, identities: ViewerReadIdentity[]): string {
  const creator = snapshot.members[thread.createdBy]?.displayName ?? thread.createdBy;
  const threadId = escapeHtml(thread.id);
  const messageCount = thread.messageCount ?? timeline.filter((i) => i.kind === "message").length;
  const title = escapeHtml(thread.title);
  const kind = escapeHtml(thread.kind);
  const metaEn = `${kind} · ${messageCount} messages · ${escapeHtml(creator)} · ${escapeHtml(formatTime(thread.createdAt))}`;
  const metaZh = `${kind} · ${messageCount} 条消息 · ${escapeHtml(creator)} · ${escapeHtml(formatTime(thread.createdAt))}`;
  const tree = buildReplyTree(timeline);
  const items = timeline.map((item, index) => renderItem(item, timeline, snapshot, room, identities, index, item.kind === "message" ? tree.issues.get(item.id) : undefined)).join("");
  return `<section class="thread" id="thread-${threadId}" data-title="${title.toLowerCase()}" data-thread-status="${escapeHtml(thread.status)}"><div class="thread-head"><div class="thread-icon status-${escapeHtml(thread.status.toLowerCase())}"></div><div class="thread-meta"><h2>${title}${statusBadge(thread.status, "thread")}</h2><div class="meta">${biHtml(metaEn, metaZh)}</div></div><div class="thread-actions"><button class="copy btn-sm" data-copy="${threadId}" data-copy-en="${threadId}" data-copy-zh="${threadId}" data-en="Copy thread ID" data-zh="复制 Thread ID">Copy thread ID</button></div></div><div class="thread-body">${items}</div></section>`;
}

export interface ViewerFreshness {
  state: "fresh" | "stale";
  message?: string;
}

export interface ViewerRefreshResult {
  snapshot?: ForumSnapshot;
  freshness: ViewerFreshness;
  readIdentities?: ViewerReadIdentity[];
}

export function renderViewerHtml(snapshot: ForumSnapshot, room: CachedRoom, freshness: ViewerFreshness = { state: "fresh" }, readIdentities: ViewerReadIdentity[] = []): string {
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
    const status = t.thread.status.toLowerCase();
    const count = t.thread.messageCount ?? t.timeline.filter((item) => item.kind === "message").length;
    return `<a class="outline-item" href="#thread-${id}" data-title="${title.toLowerCase()}" data-thread-status="${escapeHtml(status)}"><span class="outline-status status-${escapeHtml(status)}" aria-hidden="true"></span><span class="outline-title">${title}</span><span class="outline-count">${count}</span></a>`;
  }).join("");
  const threads = room.threads.map((t) => renderThread(t, snapshot, room, readIdentities)).join("");
  const roomEvents = room.events.length
    ? `<section class="thread events" id="thread-events" data-title="events"><div class="thread-head"><div class="thread-icon event"></div><div class="thread-meta"><h2>${biText("Room events", "Room 事件")}</h2></div></div><div class="thread-body">${room.events.map((event, index) => renderItem(event, room.events, snapshot, room, readIdentities, index)).join("")}</div></section>`
    : "";
  const warnings = snapshot.warnings.length
    ? `<aside class="warnings"><div class="warnings-head"><span class="warnings-icon">⚠</span><h2>${biText("Protocol warnings", "协议警告")}</h2></div>${snapshot.warnings.map((warning) => `<div class="warning"><strong>${escapeHtml(warning.code)}</strong><span>${escapeHtml(warning.path)}</span><span>— ${escapeHtml(warning.message)}</span></div>`).join("")}</aside>`
    : "";
  const noThreads = `<div class="empty">${biText("No threads yet.", "还没有 Thread。")}</div>`;
  const roomArchived = room.room.status.toLowerCase() === "archived"
    ? `<aside class="room-state archived"><strong>${biText("Archived room", "已归档 Room")}</strong><span>${biText("This Room is read-only. Return to your Agent conversation to request a restore or correction.", "此 Room 为只读状态。请回到 Agent 会话请求恢复或纠正。")}</span></aside>`
    : "";
  const revision = snapshot.sourceHead;
  const freshnessNotice = freshness.state === "stale"
    ? `<aside class="sync-state stale"><strong>${biText("Content may be stale", "内容可能已过期")}</strong><span>${escapeHtml(freshness.message ?? "Remote sync did not complete.")}</span><button type="button" onclick="location.reload()">${biText("Retry sync", "重试同步")}</button></aside>`
    : `<aside class="sync-state fresh"><strong>${biText("Remote sync complete", "远端同步完成")}</strong><span>${biText("This page was generated after the latest successful pull-only sync.", "本页面在最近一次成功的只拉取同步后生成。")}</span></aside>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(room.room.title)} — Agent Forum</title><link rel="icon" type="image/svg+xml" href="${viewerFavicon}"><style>:root{--bg:#f6f8fa;--surface:#ffffff;--surface-2:#f0f3f6;--border:#d6dbe0;--border-soft:#e8ebef;--text:#1f2328;--text-2:#59636e;--text-3:#818b96;--accent:#2563eb;--accent-2:#1d4ed8;--accent-soft:#dbeafe;--danger:#dc2626;--danger-bg:#fef2f2;--success:#16a34a;--success-bg:#dcfce7;--violet:#7c3aed;--violet-bg:#ede9fe;--neutral:#475569;--neutral-bg:#f1f5f9;--warning:#d97706;--warning-bg:#fffbeb;--radius:10px;--radius-sm:6px;--shadow:0 1px 2px rgba(31,35,40,.06),0 1px 3px rgba(31,35,40,.04);--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:ui-monospace,'SF Mono',Consolas,monospace}*{box-sizing:border-box}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}code{font-family:var(--font-mono)}header.appbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.appbar-inner{max-width:none;margin:0 auto;padding:12px 48px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.appbar-main{min-width:0;flex:1}.appbar h1{margin:0;font-size:18px;font-weight:700}.meta{color:var(--text-3);font-size:12px;margin-top:2px}.meta code{background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:11px}.search{position:relative;flex-shrink:0}.search input{width:280px;max-width:40vw;padding:7px 12px 7px 30px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-size:13px;font-family:var(--font)}.search input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)}.toolbar{display:flex;gap:8px;align-items:center}button,.btn-sm{padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;transition:all .12s}button:hover{background:var(--surface-2);color:var(--text);border-color:var(--text-3)}#close:hover{border-color:var(--danger);color:var(--danger);background:var(--danger-bg)}.btn-sm{padding:4px 10px;font-size:12px}.layout{max-width:none;margin:0 auto;padding:20px 48px 80px;display:flex;gap:40px;align-items:flex-start}.sidebar{width:280px;flex-shrink:0;position:sticky;top:64px;max-height:calc(100vh - 84px);overflow-y:auto}.sidebar h3{margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}.outline{display:flex;flex-direction:column;gap:2px;margin-bottom:24px}.outline-item{display:block;padding:6px 10px;border-radius:var(--radius-sm);font-size:13px;color:var(--text-2);border-left:2px solid transparent;transition:all .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.outline-item:hover{background:var(--surface-2);color:var(--text);text-decoration:none;border-left-color:var(--accent)}.outline-item.active{background:var(--accent-soft);color:var(--accent-2);font-weight:600;border-left-color:var(--accent)}.outline-item.hidden{display:none}.members-list{list-style:none;margin:0 0 24px;padding:0}.members-list li{padding:5px 0;border-bottom:1px solid var(--border-soft)}.members-list li:last-child{border-bottom:none}.member-name{font-weight:500;font-size:13px}.role{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-soft)}.responsibility{display:block;font-size:12px;color:var(--text-3)}.content{flex:1;min-width:0;max-width:none}.markdown p{max-width:85ch}.markdown li{max-width:85ch}.markdown .code-block{max-width:none}.markdown .md-table-wrap{max-width:100%;overflow-x:auto;margin:10px 0;border:1px solid var(--border);border-radius:var(--radius-sm)}.markdown .md-table{width:100%;border-collapse:collapse;font-size:13px}.markdown .md-table th,.markdown .md-table td{padding:8px 10px;border-bottom:1px solid var(--border-soft);vertical-align:top;white-space:nowrap}.markdown .md-table th{background:var(--surface-2);font-weight:600;text-align:left}.markdown .md-table tbody tr:last-child td{border-bottom:0}.notice{background:var(--accent-soft);border:1px solid #bfdbfe;border-radius:var(--radius-sm);padding:10px 14px;margin:0 0 20px;font-size:13px;color:#1e40af}.warnings{background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);padding:12px 14px;margin:0 0 20px}.warnings-head{display:flex;align-items:center;gap:6px;margin-bottom:8px}.warnings h2{margin:0;font-size:13px;color:var(--warning)}.warnings-icon{font-size:14px}.warning{font-size:12px;color:var(--text-2);margin:3px 0}.warning strong{font-family:var(--font-mono);color:var(--warning);margin-right:4px}.thread{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 16px;box-shadow:var(--shadow);overflow:hidden}.thread.hidden{display:none}.thread-head{padding:14px 18px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--border-soft)}.thread-icon{width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:7px;flex-shrink:0}.thread-icon.event{background:var(--warning)}.thread-meta{min-width:0;flex:1}.thread-head h2{margin:0 0 3px;font-size:16px;font-weight:600;line-height:1.35}.thread-actions{flex-shrink:0}.thread-body{padding:8px 18px 14px}.thread.events .thread-body{padding-top:6px}.item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border-soft)}.item:last-child{border-bottom:none}.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.item-main{flex:1;min-width:0;display:flex;gap:12px}.item-line{width:2px;flex-shrink:0;background:var(--border-soft);border-radius:2px}.item:hover .item-line{background:var(--accent)}.item-content{flex:1;min-width:0}.item-content>header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}.actor{font-weight:600;font-size:14px}.role{color:var(--text-3);font-size:12px}.item-content>header time{color:var(--text-3);font-size:12px;margin-left:auto}.type{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px;display:inline-flex}.read-badge{display:inline-flex;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700}.read-badge.read{background:var(--success-bg);color:var(--success)}.read-badge.unread{background:var(--warning-bg);color:var(--warning)}.read-badge.published{background:var(--accent-soft);color:var(--accent-2)}.t-default{background:var(--surface-2);color:var(--text-2)}.t-event{background:var(--warning-bg);color:var(--warning)}.t-danger{background:var(--danger-bg);color:var(--danger)}.t-success{background:var(--success-bg);color:var(--success)}.t-violet{background:var(--violet-bg);color:var(--violet)}.t-neutral{background:var(--neutral-bg);color:var(--neutral)}.body{font-size:14px;line-height:1.7;margin:8px 0;color:var(--text)}.markdown p{margin:8px 0}.markdown h3{font-size:15px;margin:14px 0 6px}.markdown h4{font-size:14px;margin:12px 0 6px}.markdown ul,.markdown ol{margin:8px 0;padding-left:22px}.markdown li{margin:3px 0}.markdown blockquote.md-quote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--border);color:var(--text-2);background:var(--surface-2);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.markdown .code-block{margin:10px 0;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--radius-sm);overflow-x:auto}.markdown .code-block code{font-size:13px;line-height:1.5}.markdown .inline-code{background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:12px}.reply{margin:0 0 12px;padding:8px 12px;background:var(--surface-2);border-left:3px solid var(--accent);border-radius:0 var(--radius-sm) var(--radius-sm) 0}.reply.missing{border-left-color:var(--danger);background:var(--danger-bg)}.reply-meta{font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:3px}.reply-body{font-size:13px;color:var(--text-2);white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}.chips-label{font-size:11px;color:var(--text-3);margin-right:2px}.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-soft)}.chip.mention{background:var(--violet-bg);color:var(--violet);border-color:var(--violet)}.chip.ref{font-family:var(--font-mono);font-size:11px}.chip.raw{font-family:var(--font-mono);font-size:11px}.item-content>footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.empty{text-align:center;padding:60px 20px;color:var(--text-3);font-size:14px}.search-empty{display:none;padding:40px 20px;text-align:center;color:var(--text-3)}.view-toggle{display:flex;gap:0;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)}.view-toggle button{border:0;border-radius:0;padding:6px 10px}.view-toggle button+button{border-left:1px solid var(--border)}.view-toggle button.active{background:var(--accent);color:#fff}.status-badge{display:inline-flex;align-items:center;margin-left:8px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;line-height:1.35;letter-spacing:.05em;text-transform:uppercase;vertical-align:middle}.room-status{margin-left:0}.status-open,.status-active{background:var(--accent-soft);color:var(--accent-2)}.status-closed,.status-archived{background:var(--neutral-bg);color:var(--neutral)}.status-unknown{background:var(--warning-bg);color:var(--warning)}.thread-icon.status-open,.thread-icon.status-active{background:var(--accent)}.thread-icon.status-closed{background:var(--neutral)}.thread-icon.status-archived{background:var(--neutral)}.outline-item{display:flex;align-items:center;gap:8px}.outline-status{width:7px;height:7px;border-radius:50%;flex-shrink:0}.outline-status.status-open,.outline-status.status-active{background:var(--accent)}.outline-status.status-closed,.outline-status.status-archived{background:var(--neutral)}.outline-status.status-unknown{background:var(--warning)}.outline-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.outline-count{font-size:11px;color:var(--text-3);font-variant-numeric:tabular-nums}.room-state{display:flex;gap:8px;align-items:flex-start;background:var(--neutral-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin:0 0 20px;font-size:13px;color:var(--text-2)}.room-state strong{color:var(--neutral);white-space:nowrap}.tree-issue{display:none;margin:8px 0;padding:6px 9px;border-left:3px solid var(--warning);background:var(--warning-bg);color:var(--warning);font-size:12px;border-radius:0 var(--radius-sm) var(--radius-sm) 0}body[data-view="tree"] .tree-issue{display:block}.tree-node{position:relative}.tree-children{margin:0 0 0 28px;padding-left:16px;border-left:2px solid var(--border-soft)}.tree-children>.tree-node{position:relative}.tree-children>.tree-node::before{content:"";position:absolute;top:30px;left:-18px;width:16px;border-top:2px solid var(--border-soft)}.tree-node>.item{padding-top:12px}.tree-node>.item:last-child{border-bottom:1px solid var(--border-soft)}.tree-node>.item .item-line{background:var(--accent-soft)}.tree-activity{margin:16px 0 2px;padding:12px 14px;border:1px dashed var(--border);border-radius:var(--radius-sm);background:var(--surface-2)}.tree-activity h3{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3)}.tree-activity-note{margin:0 0 8px;font-size:12px;color:var(--text-3)}.tree-activity .item{padding:10px 0}.tree-activity .item:last-child{border-bottom:0}@media(max-width:880px){.layout{flex-direction:column;padding:16px}.sidebar{position:static;width:auto;max-height:none}.search input{width:100%}.appbar-inner{padding:12px 16px}.content{max-width:none}.tree-children{margin-left:16px;padding-left:10px}.tree-children>.tree-node::before{left:-12px;width:10px}}</style></head><body><header class="appbar"><div class="appbar-inner"><div class="appbar-main"><h1>${escapeHtml(room.room.title)}</h1><div class="meta">${escapeHtml(snapshot.forum.name)} / ${escapeHtml(room.room.slug)} · ${statusBadge(room.room.status, "room")} · ${biHtml("snapshot", "快照")} <code>${escapeHtml(snapshot.sourceHead.slice(0, 12))}</code></div></div><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="search" type="text" data-placeholder-en="Search threads…" data-placeholder-zh="搜索主题…" placeholder="Search threads…" autocomplete="off"></div><div class="toolbar"><div class="view-toggle" role="group" aria-label="Viewer mode"><button id="view-timeline" class="active" aria-pressed="true" data-en="Timeline" data-zh="时间线">Timeline</button><button id="view-tree" aria-pressed="false" data-en="Tree" data-zh="树状">Tree</button></div><button id="lang-toggle" data-en="中文" data-zh="EN">中文</button><button id="close" data-en="Close" data-zh="关闭">Close</button></div></div></header><div class="layout"><aside class="sidebar"><h3 data-en="Threads" data-zh="主题">Threads</h3><div class="outline" id="outline">${threadOutlines}${roomEvents ? `<a class="outline-item" href="#thread-events" data-title="events">${biText("Room events", "Room 事件")}</a>` : ""}</div>${activeMembers ? `<h3 data-en="Members" data-zh="成员">Members</h3><ul class="members-list">${activeMembers}</ul>` : ""}</aside><main class="content"><p class="notice">${biText("Read-only view. Return to your Agent conversation to request corrections; history is never edited here.", "只读视图。如需纠正，请回到 Agent 会话提出；此处不会修改历史。")}</p>${roomArchived}${freshnessNotice}${warnings}${roomEvents}${threads || noThreads}<div class="search-empty" id="search-empty">${biText("No threads match your search.", "没有匹配的主题。")}</div></main></div><script nonce="agent-forum">const revision="${escapeHtml(revision)}";let lang=navigator.language.startsWith('zh')?'zh':'en';function applyLang(){document.querySelectorAll('.lang-en').forEach(e=>e.style.display=lang==='en'?'':'none');document.querySelectorAll('.lang-zh').forEach(e=>e.style.display=lang==='zh'?'':'none');document.querySelectorAll('[data-en][data-zh]').forEach(e=>e.textContent=lang==='en'?e.dataset.en:e.dataset.zh);document.querySelectorAll('[data-placeholder-en]').forEach(e=>{if(e instanceof HTMLInputElement)e.placeholder=lang==='en'?e.dataset.placeholderEn:e.dataset.placeholderZh;});document.querySelectorAll('[data-copy-en]').forEach(e=>e.dataset.copy=lang==='en'?e.dataset.copyEn:e.dataset.copyZh);}applyLang();document.getElementById('lang-toggle').addEventListener('click',()=>{lang=lang==='en'?'zh':'en';applyLang();});document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copy||'')));function restoreTimeline(thread){const body=thread.querySelector('.thread-body');if(!body)return;const items=Array.from(body.querySelectorAll('.item[data-timeline-index]')).sort((a,b)=>Number(a.dataset.timelineIndex)-Number(b.dataset.timelineIndex));body.replaceChildren(...items);}function replyRelations(messages){const byId=new Map(messages.map(item=>[item.dataset.messageId,item]));const parents=new Map();messages.forEach(item=>{const id=item.dataset.messageId;const parent=item.dataset.replyTo;if(id&&parent&&parent!==id&&byId.has(parent))parents.set(id,parent);});const cut=new Set();messages.forEach(item=>{const visited=new Map();let current=item.dataset.messageId;while(current&&parents.has(current)){if(visited.has(current)){Array.from(visited.keys()).slice(visited.get(current)).forEach(id=>cut.add(id));break;}visited.set(current,visited.size);current=parents.get(current);}});const children=new Map(messages.map(item=>[item.dataset.messageId,[]]));const roots=[];messages.forEach(item=>{const id=item.dataset.messageId;const parent=id?parents.get(id):undefined;if(id&&parent&&!cut.has(id))children.get(parent).push(id);else roots.push(id);});return{byId,children,roots};}function renderTree(thread){restoreTimeline(thread);const body=thread.querySelector('.thread-body');if(!body)return;const items=Array.from(body.querySelectorAll('.item[data-timeline-index]'));const messages=items.filter(item=>item.classList.contains('message'));const events=items.filter(item=>item.classList.contains('event'));const relation=replyRelations(messages);body.replaceChildren();const appendNode=id=>{const item=relation.byId.get(id);if(!item)return;const node=document.createElement('div');node.className='tree-node';node.append(item);const children=relation.children.get(id)||[];if(children.length){const branch=document.createElement('div');branch.className='tree-children';children.forEach(childId=>branch.append(appendNode(childId)));node.append(branch);}return node;};relation.roots.forEach(id=>{const node=appendNode(id);if(node)body.append(node);});if(events.length){const activity=document.createElement('section');activity.className='tree-activity';const heading=document.createElement('h3');heading.dataset.en='Activity';heading.dataset.zh='活动事件';heading.textContent=lang==='zh'?heading.dataset.zh:heading.dataset.en;const note=document.createElement('p');note.className='tree-activity-note';note.dataset.en='Lifecycle events are shown separately because they are not replies.';note.dataset.zh='生命周期事件独立显示，因为它们不是回复。';note.textContent=lang==='zh'?note.dataset.zh:note.dataset.en;activity.append(heading,note,...events);body.append(activity);}}const viewTimeline=document.getElementById('view-timeline');const viewTree=document.getElementById('view-tree');function setView(mode){document.body.dataset.view=mode;viewTimeline.classList.toggle('active',mode==='timeline');viewTree.classList.toggle('active',mode==='tree');viewTimeline.setAttribute('aria-pressed',String(mode==='timeline'));viewTree.setAttribute('aria-pressed',String(mode==='tree'));document.querySelectorAll('.thread').forEach(thread=>{if(mode==='tree')renderTree(thread);else restoreTimeline(thread);});}viewTimeline.addEventListener('click',()=>setView('timeline'));viewTree.addEventListener('click',()=>setView('tree'));const search=document.getElementById('search');const outlineItems=document.querySelectorAll('.outline-item');const threads=document.querySelectorAll('.thread');const searchEmpty=document.getElementById('search-empty');function runSearch(){const q=(search.value||'').trim().toLowerCase();let visibleCount=0;outlineItems.forEach(item=>{const title=item.dataset.title||'';const match=!q||title.includes(q);item.classList.toggle('hidden',!match);if(match)visibleCount++;});threads.forEach(t=>{const title=t.dataset.title||'';const match=!q||title.includes(q);t.classList.toggle('hidden',!match);});searchEmpty.style.display=visibleCount===0&&q?'block':'none';}if(search)search.addEventListener('input',runSearch);const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const id=e.target.id;outlineItems.forEach(i=>i.classList.toggle('active',i.getAttribute('href')==='#'+id));}});},{rootMargin:'-72px 0px -70% 0px'});threads.forEach(t=>observer.observe(t));document.getElementById('close').addEventListener('click',async()=>{try{await fetch(location.pathname+'close',{method:'POST'});document.body.innerHTML='<div style="max-width:600px;margin:80px auto;padding:20px;font-family:system-ui;text-align:center;color:#59636e"><p>Viewer closed.</p></div>'}catch{}});if(location.protocol==='http:')setInterval(async()=>{try{const next=await(await fetch(location.pathname+'revision')).json();if(next.revision!==revision)location.reload()}catch{}},2000)</script></body></html>`;
}

export interface ViewerHandle {
  url: string;
  token: string;
  port: number;
  updateSnapshot: (snapshot: ForumSnapshot, freshness?: ViewerFreshness) => void;
  closed: Promise<void>;
  close: () => Promise<void>;
}

export async function startViewerServer(input: {
  snapshot: ForumSnapshot;
  roomIdOrSlug: string;
  idleMs?: number;
  token?: string;
  refresh?: () => Promise<ViewerRefreshResult>;
  readIdentities?: ViewerReadIdentity[];
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
  let freshness: ViewerFreshness = input.refresh ? { state: "stale", message: "Waiting for remote sync." } : { state: "fresh" };
  let readIdentities = input.readIdentities ?? [];
  let html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities);
  let revision = currentSnapshot.sourceHead;
  let refreshInFlight: Promise<void> | undefined;
  const refresh = async (): Promise<void> => {
    if (!input.refresh) return;
    if (!refreshInFlight) {
      refreshInFlight = input.refresh()
        .then((result) => {
          freshness = result.freshness;
          if (result.readIdentities) readIdentities = result.readIdentities;
          if (result.snapshot) {
            const nextRoom = result.snapshot.rooms.find((candidate) => candidate.room.id === room.room.id);
            if (nextRoom) {
              currentSnapshot = result.snapshot;
              currentRoom = nextRoom;
              revision = result.snapshot.sourceHead;
            }
          }
          html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities);
        })
        .catch(() => {
          freshness = { state: "stale", message: "Remote sync failed unexpectedly." };
          html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities);
        })
        .finally(() => { refreshInFlight = undefined; });
    }
    await refreshInFlight;
  };
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
    void (async () => {
    touch();
    response.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-agent-forum'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && request.url === basePath) {
      await refresh();
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
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Viewer request failed");
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    function onError(error: Error) { server.off("listening", onListening); rejectListen(error); }
    function onListening() { server.off("error", onError); resolveListen(); }
    server.once("error", onError);
    server.once("listening", onListening);
    // 由操作系统选择可用端口，避免 Windows 动态端口区中的保留范围随机返回 EACCES。
    server.listen(0, "127.0.0.1");
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
    updateSnapshot: (snapshot, nextFreshness = { state: "fresh" }) => {
      const nextRoom = snapshot.rooms.find(
        (candidate) => candidate.room.id === room.room.id,
      );
      if (!nextRoom) return;
      currentSnapshot = snapshot;
      currentRoom = nextRoom;
      freshness = nextFreshness;
      revision = snapshot.sourceHead;
      html = renderViewerHtml(currentSnapshot, currentRoom, freshness, readIdentities);
    },
    close,
  };
}