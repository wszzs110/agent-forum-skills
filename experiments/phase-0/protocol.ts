import { randomBytes, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve, sep } from "node:path";

export const DRAFT_VERSION = "0-draft";

const protocolIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const messageIdPattern = /^msg_[0-9]{8}T[0-9]{9}Z_[0-9a-f]{12}$/u;
const referenceKinds = new Set([
  "repository",
  "branch",
  "commit",
  "path",
  "symbol",
  "endpoint",
  "ticket",
  "url",
]);
const messageTypes = new Set([
  "discussion",
  "question",
  "answer",
  "proposal",
  "decision",
  "change",
  "blocker",
  "review",
  "status",
  "test-result",
  "acknowledgement",
]);

export interface MessageReference {
  kind:
    | "repository"
    | "branch"
    | "commit"
    | "path"
    | "symbol"
    | "endpoint"
    | "ticket"
    | "url";
  value: string;
}

export interface MessageMetadata {
  schemaVersion: typeof DRAFT_VERSION;
  id: string;
  threadId: string;
  authorId: string;
  type: string;
  createdAt: string;
  replyTo?: string | null;
  mentions: string[];
  references: MessageReference[];
}

export interface ForumSeed {
  forumId: string;
  roomId: string;
  threadId: string;
  createdAt: string;
}

function assertProtocolId(value: string, field: string): void {
  if (!protocolIdPattern.test(value)) {
    throw new Error(`${field} is not a safe protocol identifier: ${value}`);
  }
}

function assertIsoUtc(value: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`createdAt must be a canonical UTC timestamp: ${value}`);
  }
}

function resolveInside(root: string, ...segments: string[]): string {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, ...segments);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`path escapes forum root: ${target}`);
  }
  return target;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function createMessageId(now = new Date()): string {
  const timestamp = now.toISOString().replaceAll(/[-:.]/gu, "");
  return `msg_${timestamp}_${randomBytes(6).toString("hex")}`;
}

export function validateMessage(message: MessageMetadata, body: string): void {
  if (message.schemaVersion !== DRAFT_VERSION) {
    throw new Error(`unsupported draft schema version: ${message.schemaVersion}`);
  }
  if (!messageIdPattern.test(message.id)) {
    throw new Error(`invalid message id: ${message.id}`);
  }
  assertProtocolId(message.threadId, "threadId");
  assertProtocolId(message.authorId, "authorId");
  if (!messageTypes.has(message.type)) {
    throw new Error(`unsupported message type: ${message.type}`);
  }
  assertIsoUtc(message.createdAt);
  if (message.replyTo !== undefined && message.replyTo !== null) {
    if (!messageIdPattern.test(message.replyTo)) {
      throw new Error(`invalid replyTo id: ${message.replyTo}`);
    }
  }
  if (new Set(message.mentions).size !== message.mentions.length) {
    throw new Error("mentions must be unique");
  }
  for (const mention of message.mentions) assertProtocolId(mention, "mention");
  for (const reference of message.references) {
    if (!referenceKinds.has(reference.kind)) {
      throw new Error(`unsupported reference kind: ${reference.kind}`);
    }
    if (reference.value.length === 0 || reference.value.length > 2048) {
      throw new Error("reference value length must be between 1 and 2048");
    }
  }
  if (body.trim().length === 0) throw new Error("message body must not be empty");
  if (body.includes("\0")) throw new Error("message body must not contain NUL");
}

export async function initializeForumLayout(
  repositoryRoot: string,
  seed: ForumSeed,
): Promise<void> {
  assertProtocolId(seed.forumId, "forumId");
  assertProtocolId(seed.roomId, "roomId");
  assertProtocolId(seed.threadId, "threadId");
  assertIsoUtc(seed.createdAt);

  const forumDirectory = resolveInside(repositoryRoot, ".forum");
  const threadDirectory = resolveInside(
    repositoryRoot,
    "rooms",
    seed.roomId,
    "threads",
    seed.threadId,
  );
  await mkdir(forumDirectory, { recursive: true });
  await mkdir(resolveInside(threadDirectory, "messages"), { recursive: true });

  // 论坛协议文本统一使用 LF，避免不同平台的 autocrlf 设置制造脏工作区。
  await writeFile(
    resolveInside(repositoryRoot, ".gitattributes"),
    "*.json text eol=lf\n*.md text eol=lf\n",
    "utf8",
  );
  await writeJson(resolveInside(forumDirectory, "protocol.json"), {
    protocolVersion: DRAFT_VERSION,
    forumId: seed.forumId,
    createdAt: seed.createdAt,
  });
  await writeJson(resolveInside(repositoryRoot, "rooms", seed.roomId, "room.json"), {
    schemaVersion: DRAFT_VERSION,
    id: seed.roomId,
    title: "Checkout",
    createdAt: seed.createdAt,
  });
  await writeJson(resolveInside(threadDirectory, "thread.json"), {
    schemaVersion: DRAFT_VERSION,
    id: seed.threadId,
    title: "Checkout API contract",
    status: "open",
    createdAt: seed.createdAt,
  });
}

export async function writeImmutableMessage(
  repositoryRoot: string,
  roomId: string,
  message: MessageMetadata,
  body: string,
): Promise<string> {
  assertProtocolId(roomId, "roomId");
  validateMessage(message, body);

  const messagesDirectory = resolveInside(
    repositoryRoot,
    "rooms",
    roomId,
    "threads",
    message.threadId,
    "messages",
  );
  const finalDirectory = resolveInside(messagesDirectory, message.id);
  if (await exists(finalDirectory)) {
    throw new Error(`message already exists and is immutable: ${message.id}`);
  }

  await mkdir(messagesDirectory, { recursive: true });
  const temporaryDirectory = resolveInside(
    messagesDirectory,
    `.agent-forum-tmp-${randomUUID()}`,
  );

  try {
    await mkdir(temporaryDirectory);
    await writeJson(resolveInside(temporaryDirectory, "message.json"), message);
    await writeFile(resolveInside(temporaryDirectory, "body.md"), body, "utf8");
    await rename(temporaryDirectory, finalDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  return finalDirectory;
}
