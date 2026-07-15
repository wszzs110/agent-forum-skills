import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  DRAFT_VERSION,
  createMessageId,
  initializeForumLayout,
  validateMessage,
  writeImmutableMessage,
  type MessageMetadata,
} from "../experiments/phase-0/protocol.js";

function message(id = "msg_20260712T160000000Z_a1b2c3d4e5f6"): MessageMetadata {
  return {
    schemaVersion: DRAFT_VERSION,
    id,
    threadId: "checkout-api",
    authorId: "backend-a",
    type: "change",
    createdAt: "2026-07-12T16:00:00.000Z",
    mentions: ["frontend-b"],
    references: [{ kind: "endpoint", value: "POST /api/orders" }],
  };
}

test("message IDs are sortable, path-safe, and contain random entropy", () => {
  const id = createMessageId(new Date("2026-07-12T16:00:00.123Z"));
  assert.match(id, /^msg_20260712T160000123Z_[0-9a-f]{12}$/u);
});

test("a message is atomically materialized as JSON metadata and Markdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-forum-protocol-"));
  try {
    await initializeForumLayout(root, {
      forumId: "a-team",
      roomId: "checkout",
      threadId: "checkout-api",
      createdAt: "2026-07-12T16:00:00.000Z",
    });
    const metadata = message();
    const body = "Endpoint changed.\n";
    const directory = await writeImmutableMessage(
      root,
      "checkout",
      metadata,
      body,
    );

    assert.deepEqual(
      JSON.parse(await readFile(resolve(directory, "message.json"), "utf8")),
      metadata,
    );
    assert.equal(await readFile(resolve(directory, "body.md"), "utf8"), body);
    const siblingNames = await readdir(resolve(directory, ".."));
    assert.deepEqual(siblingNames, [metadata.id]);

    await assert.rejects(
      writeImmutableMessage(root, "checkout", metadata, "Replacement\n"),
      /immutable/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("draft validation rejects unsafe identifiers and duplicate mentions", () => {
  assert.throws(
    () => validateMessage({ ...message(), threadId: "../escape" }, "Body\n"),
    /safe protocol identifier/u,
  );
  assert.throws(
    () =>
      validateMessage(
        { ...message(), mentions: ["frontend-b", "frontend-b"] },
        "Body\n",
      ),
    /mentions must be unique/u,
  );
});

test("the format comparison contains equivalent JSON and Markdown content", async () => {
  const fixtureRoot = resolve("experiments/phase-0/message-format");
  const json = JSON.parse(
    await readFile(resolve(fixtureRoot, "json-markdown/message.json"), "utf8"),
  );
  const body = await readFile(
    resolve(fixtureRoot, "json-markdown/body.md"),
    "utf8",
  );
  const frontmatter = await readFile(
    resolve(fixtureRoot, "frontmatter/message.md"),
    "utf8",
  );

  assert.equal(json.id, "msg_20260712T160000000Z_a1b2c3d4e5f6");
  assert.match(frontmatter, /id: msg_20260712T160000000Z_a1b2c3d4e5f6/u);
  assert.ok(frontmatter.endsWith(body));
});
