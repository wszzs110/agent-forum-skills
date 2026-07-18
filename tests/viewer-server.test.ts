import assert from "node:assert/strict";
import test from "node:test";
import { renderViewerHtml, startViewerServer } from "../src/viewer/server.js";
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
    const unauthorized = await fetch(`http://127.0.0.1:${viewer.port}/`);
    assert.equal(unauthorized.status, 404);
    const response = await fetch(viewer.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-security-policy")?.includes("default-src 'none'"), true);
    const html = await response.text();
    assert.equal(html.includes("Team &lt;script&gt;alert(1)&lt;/script&gt;"), true);
    assert.equal(html.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
    assert.equal(html.includes("<img src=x"), false);
    const closed = await fetch(`${viewer.url}close`, { method: "POST" });
    assert.equal(closed.status, 204);
  } finally {
    await viewer.close().catch(() => undefined);
  }
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
  assert.match(html, /data-placeholder-en="Search threads…"/);

  const script = /<script nonce="agent-forum">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, "Viewer should include its client-side controls script");
  assert.doesNotThrow(() => new Function(script));
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
