import assert from "node:assert/strict";
import test from "node:test";
import { buildReplyGraph, buildReplyTree, renderViewerHtml, startViewerServer } from "../src/viewer/server.js";
import type { ForumSnapshot } from "../src/services/timeline-cache.js";

function snapshot(): ForumSnapshot {
  return {
    formatVersion: 1,
    forumAlias: "team",
    forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc",
    sourceHead: "0123456789abcdef",
    generatedAt: "2026-07-12T10:00:00.000Z",
    forum: {
      forumId: "forum_0194f6d2-8c10-7a31-9e42-123456789abc",
      name: "Team <script>alert(1)</script>",
      description: "Forum",
      status: "active",
      createdBy: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
      createdAt: "2026-07-12T10:00:00.000Z",
      lastActivityAt: "2026-07-12T10:00:00.000Z",
    },
    members: {
      "member_0194f6d2-8c10-7a31-9e42-123456789ac1": {
        displayName: "Agent A",
        role: "backend",
        responsibility: "API",
        status: "active",
      },
    },
    rooms: [
      {
        room: {
          id: "room_0194f6d2-8c10-7a31-9e42-123456789abd",
          slug: "checkout",
          title: "Checkout",
          description: "Room",
          status: "active",
          createdBy: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
          createdAt: "2026-07-12T10:00:00.000Z",
          lastActivityAt: "2026-07-12T10:00:00.000Z",
        },
        sourceHead: "0123456789abcdef",
        members: {
          "member_0194f6d2-8c10-7a31-9e42-123456789ac1": {
            role: "backend",
            responsibility: "API",
            status: "active",
          },
        },
        events: [],
        threads: [
          {
            thread: {
              id: "thread_0194f6d2-8c10-7a31-9e42-123456789abe",
              roomId: "room_0194f6d2-8c10-7a31-9e42-123456789abd",
              title: "Question",
              kind: "question",
              status: "open",
              createdBy: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
              createdAt: "2026-07-12T10:00:00.000Z",
              firstMessageId: "msg_0194f6d2-8c10-7a31-9e42-123456789abf",
              lastActivityAt: "2026-07-12T10:00:00.000Z",
              messageCount: 1,
            },
            timeline: [
              {
                kind: "message",
                id: "msg_0194f6d2-8c10-7a31-9e42-123456789abf",
                threadId: "thread_0194f6d2-8c10-7a31-9e42-123456789abe",
                authorId: "member_0194f6d2-8c10-7a31-9e42-123456789ac1",
                type: "question",
                createdAt: "2026-07-12T10:00:00.000Z",
                replyTo: null,
                mentions: [],
                references: [],
                body: "<img src=x onerror=alert(1)>",
              },
            ],
          },
        ],
      },
    ],
    warnings: [],
  };
}

test("Viewer binds to loopback, requires the token path, escapes content, and closes", async () => {
  const viewer = await startViewerServer({
    snapshot: snapshot(),
    roomIdOrSlug: "checkout",
    token: "0123456789abcdef0123456789abcdef",
    idleMs: 10_000,
  });
  try {
    assert.equal(viewer.url.startsWith("http://127.0.0.1:"), true);
    assert.equal(Number.isInteger(viewer.port) && viewer.port > 0, true);
    const unauthorized = await fetch(`http://127.0.0.1:${viewer.port}/`);
    assert.equal(unauthorized.status, 404);
    const response = await fetch(viewer.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-security-policy")?.includes("default-src 'none'"), true);
    assert.equal(response.headers.get("content-security-policy")?.includes("img-src data:"), true);
    const html = await response.text();
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,%3Csvg/u);
    assert.equal(html.includes("Team &lt;script&gt;alert(1)&lt;/script&gt;"), true);
    assert.equal(html.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
    assert.equal(html.includes("<img src=x"), false);
    const closed = await fetch(`${viewer.url}close`, { method: "POST" });
    assert.equal(closed.status, 204);
  } finally {
    await viewer.close().catch(() => undefined);
  }
});

test("Viewer refreshes before every page response and coalesces concurrent refreshes", async () => {
  let refreshes = 0;
  const fresh = snapshot();
  fresh.sourceHead = "fedcba9876543210";
  fresh.rooms[0]!.sourceHead = fresh.sourceHead;
  const viewer = await startViewerServer({
    snapshot: snapshot(),
    roomIdOrSlug: "checkout",
    token: "abcdefabcdefabcdefabcdefabcdefab",
    refresh: async () => {
      refreshes += 1;
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      return { snapshot: fresh, freshness: { state: "fresh" } };
    },
  });
  try {
    const [first, second] = await Promise.all([fetch(viewer.url), fetch(viewer.url)]);
    assert.equal(refreshes, 1, "parallel page loads share one sync");
    assert.match(await first.text(), /fedcba987654/);
    assert.match(await second.text(), /Synced/);
    await fetch(viewer.url);
    assert.equal(refreshes, 2, "a browser refresh performs a new sync");
  } finally {
    await viewer.close();
  }
});

test("Viewer renders stale state without claiming cache is current after refresh failure", async () => {
  const viewer = await startViewerServer({
    snapshot: snapshot(),
    roomIdOrSlug: "checkout",
    token: "1234567890abcdef1234567890abcdef",
    refresh: async () => ({
      freshness: { state: "stale", message: "Remote sync failed (SYNC_NETWORK_FAILED)." },
    }),
  });
  try {
    const response = await fetch(viewer.url);
    const html = await response.text();
    assert.match(html, /Stale/);
    assert.match(html, /SYNC_NETWORK_FAILED/);
    assert.equal(html.includes("Remote sync complete"), false);
  } finally {
    await viewer.close();
  }
  const localized = renderViewerHtml(snapshot(), snapshot().rooms[0]!, {
    state: "stale",
    message: "No remote is configured for this Team; latest remote content cannot be verified.",
  });
  assert.match(localized, /此 Forum 未配置 remote，无法验证远端最新内容。/u);
});

test("Viewer collapses and scopes de-duplicated protocol warnings to the current Room", () => {
  const input = snapshot();
  const currentPath = `rooms/${input.rooms[0]!.room.id}/room.json`;
  input.warnings = [
    { code: "ROOM_DEPRECATED", path: currentPath, message: "current room was deprecated" },
    { code: "ROOM_DEPRECATED", path: currentPath, message: "current room was deprecated" },
    { code: "INVALID_MESSAGE_PATH", path: "rooms/room_elsewhere/messages/msg_legacy", message: "legacy message" },
  ];

  const html = renderViewerHtml(input, input.rooms[0]!);
  assert.match(html, /<details class="warnings">/u, "warnings are collapsed by default");
  assert.doesNotMatch(html, /<details class="warnings" open>/u);
  assert.equal((html.match(/ROOM_DEPRECATED/g) ?? []).length, 1);
  assert.equal(html.includes("room_elsewhere"), false, "other Room warnings stay out of this Viewer");
});

test("Viewer renders safe Markdown and exposes functional client-side controls", () => {
  const input = snapshot();
  const room = input.rooms[0]!;
  const first = room.threads[0]!.timeline[0]!;
  if (first.kind !== "message") throw new Error("fixture must start with a message");
  first.body = `# Heading\n\n- first item\n- second item\n\n1. ordered item\n2. next item\n\n> quoted context\n\nInline \`code\` and **bold**.\n\n[Safe link](https://example.com/docs) [Unsafe link](javascript:alert).\n\n\`\`\`ts\nconst answer = 42;\n\`\`\``;
  const html = renderViewerHtml(input, room);

  assert.match(html, /<h3>Heading<\/h3>/);
  assert.match(html, /<ul>\s*<li>first item<\/li>\s*<li>second item<\/li>\s*<\/ul>/);
  assert.match(html, /<ol>\s*<li>ordered item<\/li>\s*<li>next item<\/li>\s*<\/ol>/);
  assert.match(html, /<blockquote class="md-quote">quoted context<\/blockquote>/);
  assert.match(html, /<code class="inline-code">code<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com\/docs"/);
  assert.equal(html.includes('href="javascript:'), false);
  assert.match(html, /<pre class="code-block"><code>ts\nconst answer = 42;\n<\/code><\/pre>/);
  assert.match(html, /class="sidebar"/);
  assert.match(html, /class="outline-item"/);
  assert.match(html, /id="search"/);
  assert.match(html, /data-placeholder-en="Search"/);
  assert.equal(html.includes(".lang-zh{display:none}"), false, "language switching must not leave Chinese content hidden by CSS");
  assert.match(html, /id="previous-unread"/u);
  assert.match(html, /id="next-unread"/u);
  assert.match(html, /let unreadSelection=null/u);
  assert.match(html, /current<0\?0:\(current\+direction\+items\.length\)%items\.length/u, "first navigation selects the first unread item as the baseline");
  assert.match(html, /unread-selected/u);
  assert.match(html, /outline-unread/u);
  assert.match(html, /outline-unread[^}]*background:#eff6ff/u, "unread badge should share the Viewer blue palette");
  assert.match(html, /graph-canvas\{position:absolute/u, "Tree view exposes a Git Graph gutter");
  assert.match(html, /function drawReplyGraph\(graph,relation\)/u, "Tree view redraws graph paths from real row geometry");
  assert.match(html, /className='graph-row'/u, "Tree view keeps one row per message");

  const script = /<script nonce="agent-forum">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, "Viewer should include its client-side controls script");
  assert.doesNotThrow(() => new Function(script));
});

test("Viewer distinguishes local AI unread, read, and published states", () => {
  const input = snapshot();
  const room = input.rooms[0]!;
  const readerId = "member_0194f6d2-8c10-7a31-9e42-123456789ac2";
  input.members[readerId] = { displayName: "Agent B", role: "frontend", responsibility: "UI", status: "active" };
  room.members[readerId] = { role: "frontend", responsibility: "UI", status: "active", updatedAt: "2026-07-12T09:59:00.000Z" };
  const messageId = room.threads[0]!.timeline[0]!.id;

  const unread = renderViewerHtml(input, room, { state: "fresh" }, [{ memberId: readerId, displayName: "Agent B", seenIds: [] }]);
  assert.match(unread, /class="read-badge unread"/u);
  assert.match(unread, />Unread<\/span>/u);
  assert.match(unread, /data-ai-unread="true"/u);
  assert.match(unread, /class="outline-unread"/u);
  assert.doesNotMatch(unread, /outline-count/u, "Thread outline shows only the unread count");

  const read = renderViewerHtml(input, room, { state: "fresh" }, [{ memberId: readerId, displayName: "Agent B", seenIds: [messageId] }]);
  assert.match(read, /class="read-badge read"/u);
  assert.match(read, />Read<\/span>/u);

  const published = renderViewerHtml(input, room, { state: "fresh" }, [{ memberId: room.threads[0]!.timeline[0]!.kind === "message" ? room.threads[0]!.timeline[0]!.authorId : "", displayName: "Agent A", seenIds: [] }]);
  assert.match(published, /class="read-badge published"/u);
  assert.match(published, />Published<\/span>/u);

  room.threads[0]!.thread.status = "closed";
  const closed = renderViewerHtml(input, room, { state: "fresh" }, [{ memberId: readerId, displayName: "Agent B", seenIds: [] }]);
  assert.doesNotMatch(closed, /<article[^>]*data-ai-unread="true"/u, "closed Thread history does not become a Viewer unread target");
  assert.doesNotMatch(closed, /<span class="outline-unread"/u, "closed Thread outline does not show unread counts");
  assert.match(closed, /dataset\.threadStatus!==['"]closed['"]/u, "Viewer navigation defensively skips closed Threads");
});

test("Viewer displays the bound directory and branch only when supplied by the local launcher", () => {
  const html = renderViewerHtml(snapshot(), snapshot().rooms[0]!, { state: "fresh" }, [], "en", {
    workspaceRoot: "C:\\work\\agent-forum<&>",
    branch: "feature/viewer-context",
  });
  assert.match(html, /class="binding-context"/u);
  assert.match(html, /Path<\/span>/u);
  assert.match(html, /C:\\work\\agent-forum&lt;&amp;&gt;/u);
  assert.match(html, /Branch<\/span>/u);
  assert.match(html, /feature\/viewer-context/u);

  const explicit = renderViewerHtml(snapshot(), snapshot().rooms[0]!);
  assert.doesNotMatch(explicit, /class="binding-context"/u, "explicit Forum/Room targets do not disclose an unrelated local path");
});

test("Viewer renders safe GFM pipe tables", () => {
  const input = snapshot();
  const room = input.rooms[0]!;
  const first = room.threads[0]!.timeline[0]!;
  if (first.kind !== "message") throw new Error("fixture must start with a message");
  first.body = `| Name | Result | Link |
| :--- | ---: | :---: |
| Alpha | 42 | [Safe](https://example.com) |
| &lt;script&gt; | 7 | [Unsafe](javascript:alert) |`;

  const html = renderViewerHtml(input, room);

  assert.match(html, /<table class="md-table"><thead><tr><th style="text-align:left">Name<\/th><th style="text-align:right">Result<\/th><th style="text-align:center">Link<\/th><\/tr><\/thead><tbody>/);
  assert.match(html, /<td style="text-align:left">Alpha<\/td><td style="text-align:right">42<\/td><td style="text-align:center"><a href="https:\/\/example\.com"/);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes('href="javascript:'), false);
});

test("Viewer derives a safe reply forest without losing malformed branches", () => {
  const input = snapshot();
  const opening = input.rooms[0]!.threads[0]!.timeline[0]!;
  if (opening.kind !== "message") throw new Error("fixture must start with a message");
  const reply = { ...opening, id: "msg_reply", replyTo: opening.id, createdAt: "2026-07-12T10:01:00.000Z" };
  const nestedReply = { ...opening, id: "msg_nested", replyTo: reply.id, createdAt: "2026-07-12T10:02:00.000Z" };
  const orphan = { ...opening, id: "msg_orphan", replyTo: "msg_missing", createdAt: "2026-07-12T10:03:00.000Z" };
  const cycleA = { ...opening, id: "msg_cycle_a", replyTo: "msg_cycle_b", createdAt: "2026-07-12T10:04:00.000Z" };
  const cycleB = { ...opening, id: "msg_cycle_b", replyTo: cycleA.id, createdAt: "2026-07-12T10:05:00.000Z" };
  const tree = buildReplyTree([opening, reply, nestedReply, orphan, cycleA, cycleB]);
  const branchReply = { ...opening, id: "msg_branch", replyTo: opening.id, createdAt: "2026-07-12T10:02:30.000Z" };
  const graph = buildReplyGraph([opening, reply, nestedReply, branchReply]);

  assert.equal(graph.lanes.get(opening.id), 0);
  assert.equal(graph.lanes.get(reply.id), 0);
  assert.equal(graph.lanes.get(branchReply.id), 1);
  assert.equal(graph.lanes.get(nestedReply.id), 0);
  assert.equal(graph.laneCount, 2);
  assert.deepEqual(tree.children.get(opening.id), [reply.id]);
  assert.deepEqual(tree.children.get(reply.id), [nestedReply.id]);
  assert.equal(tree.issues.get(orphan.id), "missing-parent");
  assert.equal(tree.issues.get(cycleA.id), "cycle");
  assert.equal(tree.issues.get(cycleB.id), "cycle");
  assert.equal(tree.roots.includes(orphan.id), true);
  assert.equal(tree.roots.includes(cycleA.id), true);
  assert.equal(tree.roots.includes(cycleB.id), true);
});

test("Viewer exposes status markers and a timeline/tree switch", () => {
  const input = snapshot();
  const room = input.rooms[0]!;
  room.threads[0]!.thread.status = "closed";
  const html = renderViewerHtml(input, room);

  assert.match(html, /id="view-timeline"/);
  assert.match(html, /id="view-tree"/);
  assert.match(html, /class="status-badge thread-status status-closed"/);
  assert.match(html, /class="outline-status status-closed"/);
  assert.match(html, /data-reply-to=""/);
  assert.match(html, /data-graph-lanes="1"/);
  assert.match(html, /data-graph-lane="0"/);
  assert.match(html, /function renderTree\(thread\)/);
  assert.match(html, /Lifecycle events are shown separately/);
});

test("Viewer preserves dense multi-member reply networks in the outline and timeline", () => {
  const input = snapshot();
  const room = input.rooms[0]!;
  const memberIds = ["member_dense_a", "member_dense_b", "member_dense_c", "member_dense_d"];
  for (const [index, memberId] of memberIds.entries()) {
    input.members[memberId] = {
      displayName: `Dense Agent ${index + 1}`,
      role: "reviewer",
      responsibility: "Dense Viewer fixture",
      status: "active",
    };
    room.members[memberId] = {
      role: "reviewer",
      responsibility: "Dense Viewer fixture",
      status: "active",
    };
  }

  room.threads = Array.from({ length: 24 }, (_, threadIndex) => {
    const threadId = `thread_dense_${threadIndex}`;
    const timeline = Array.from({ length: 9 }, (_, messageIndex) => ({
      kind: "message" as const,
      id: `msg_dense_${threadIndex}_${messageIndex}`,
      threadId,
      authorId: memberIds[(threadIndex + messageIndex) % memberIds.length]!,
      type: messageIndex === 0 ? "discussion" : messageIndex % 3 === 0 ? "answer" : "question",
      createdAt: `2026-07-12T10:${String(threadIndex).padStart(2, "0")}:${String(messageIndex).padStart(2, "0")}.000Z`,
      replyTo: messageIndex === 0 ? null : `msg_dense_${threadIndex}_${Math.floor((messageIndex - 1) / 2)}`,
      mentions: messageIndex % 2 === 0 ? [memberIds[(threadIndex + 1) % memberIds.length]!] : [],
      references: messageIndex % 3 === 0 ? [{ kind: "ticket", value: `AF-${threadIndex}-${messageIndex}` }] : [],
      body: `Thread ${threadIndex} / reply ${messageIndex}: **dense** discussion body.`,
    }));
    return {
      thread: {
        id: threadId,
        roomId: room.room.id,
        title: `Dense thread ${threadIndex}`,
        kind: "discussion" as const,
        status: "open" as const,
        createdBy: memberIds[threadIndex % memberIds.length]!,
        createdAt: `2026-07-12T10:${String(threadIndex).padStart(2, "0")}:00.000Z`,
        firstMessageId: timeline[0]!.id,
        lastActivityAt: timeline[8]!.createdAt,
        messageCount: timeline.length,
      },
      timeline,
    };
  });

  const html = renderViewerHtml(input, room);
  assert.equal((html.match(/class="outline-item"/g) ?? []).length, 24);
  assert.equal((html.match(/class="thread"/g) ?? []).length, 24);
  assert.equal((html.match(/class="reply"/g) ?? []).length, 24 * 8);
  assert.match(html, /Dense Agent 4/);
  assert.match(html, /AF-23-6/);
});
