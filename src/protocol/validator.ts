import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import commonSchema from "../../schemas/v1/common.schema.json" with { type: "json" };
import contextBindingsSchema from "../../schemas/v1/context-bindings.schema.json" with { type: "json" };
import eventSchema from "../../schemas/v1/event.schema.json" with { type: "json" };
import forumSchema from "../../schemas/v1/forum.schema.json" with { type: "json" };
import inboxCursorSchema from "../../schemas/v1/inbox-cursor.schema.json" with { type: "json" };
import identityAttentionSchema from "../../schemas/v1/identity-attention.schema.json" with { type: "json" };
import localConfigSchema from "../../schemas/v1/local-config.schema.json" with { type: "json" };
import memberProfileSchema from "../../schemas/v1/member-profile.schema.json" with { type: "json" };
import messageSchema from "../../schemas/v1/message.schema.json" with { type: "json" };
import protocolSchema from "../../schemas/v1/protocol.schema.json" with { type: "json" };
import publishPolicySchema from "../../schemas/v1/publish-policy.schema.json" with { type: "json" };
import roomMemberSchema from "../../schemas/v1/room-member.schema.json" with { type: "json" };
import roomSchema from "../../schemas/v1/room.schema.json" with { type: "json" };
import threadSchema from "../../schemas/v1/thread.schema.json" with { type: "json" };
import threadWatchSchema from "../../schemas/v1/thread-watch.schema.json" with { type: "json" };
import { isCanonicalUtcTimestamp } from "../domain/timestamps.js";

export type ProtocolSchemaName =
  | "protocol"
  | "context-bindings"
  | "publish-policy"
  | "forum"
  | "inbox-cursor"
  | "identity-attention"
  | "local-config"
  | "member-profile"
  | "room-member"
  | "room"
  | "thread"
  | "thread-watch"
  | "message"
  | "event";

export interface ValidationIssue {
  path: string;
  keyword: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

const schemaDocuments = {
  protocol: protocolSchema,
  "context-bindings": contextBindingsSchema,
  "publish-policy": publishPolicySchema,
  forum: forumSchema,
  "inbox-cursor": inboxCursorSchema,
  "identity-attention": identityAttentionSchema,
  "local-config": localConfigSchema,
  "member-profile": memberProfileSchema,
  "room-member": roomMemberSchema,
  room: roomSchema,
  thread: threadSchema,
  "thread-watch": threadWatchSchema,
  message: messageSchema,
  event: eventSchema,
} as const;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
ajv.addFormat("utc-date-time-ms", {
  type: "string",
  validate: isCanonicalUtcTimestamp,
});
ajv.addSchema(commonSchema);

const validators = new Map<ProtocolSchemaName, ValidateFunction>();
for (const [name, schema] of Object.entries(schemaDocuments)) {
  validators.set(name as ProtocolSchemaName, ajv.compile(schema));
}

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "schema validation failed",
  }));
}

export function normalizeProtocolReadDocument(
  schemaName: ProtocolSchemaName,
  value: unknown,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const versionField = schemaName === "protocol" ? "protocolVersion" : "schemaVersion";
  let normalized: Record<string, unknown> | undefined;
  const version = record[versionField];
  // 仅接受可无歧义映射到当前 major 的历史短写；绝不写回或改动 Git 历史。
  if (version === 1 || version === "1" || (typeof version === "string" && /^1\.\d+$/u.test(version))) {
    normalized = { ...record, [versionField]: "1.0" };
  }
  const createdAt = record.createdAt;
  if (
    typeof createdAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(createdAt) &&
    !isCanonicalUtcTimestamp(createdAt)
  ) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.valueOf())) normalized = { ...(normalized ?? record), createdAt: date.toISOString() };
  }
  return normalized ?? value;
}

export function validateProtocolDocument(
  schemaName: ProtocolSchemaName,
  value: unknown,
  options: { mode?: "read" | "write" } = {},
): ValidationResult {
  const validator = validators.get(schemaName);
  if (!validator) {
    return {
      ok: false,
      issues: [
        {
          path: "/",
          keyword: "schema",
          message: `unknown protocol schema: ${schemaName}`,
        },
      ],
    };
  }
  const mode = options.mode ?? "write";
  const candidate = mode === "read" ? normalizeProtocolReadDocument(schemaName, value) : value;

  if (validator(candidate)) return { ok: true };
  const issues = toIssues(validator.errors).filter(
    (issue) => mode !== "read" || issue.keyword !== "additionalProperties",
  );
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
