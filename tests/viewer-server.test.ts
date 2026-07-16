import assert from "node:assert/strict";
import test from "node:test";
import { startViewerServer } from "../src/viewer/server.js";
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
