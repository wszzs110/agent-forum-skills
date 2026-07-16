import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import commonSchema from "../../schemas/v1/common.schema.json" with { type: "json" };
import eventSchema from "../../schemas/v1/event.schema.json" with { type: "json" };
import forumSchema from "../../schemas/v1/forum.schema.json" with { type: "json" };
import localConfigSchema from "../../schemas/v1/local-config.schema.json" with { type: "json" };
import memberProfileSchema from "../../schemas/v1/member-profile.schema.json" with { type: "json" };
import messageSchema from "../../schemas/v1/message.schema.json" with { type: "json" };
import protocolSchema from "../../schemas/v1/protocol.schema.json" with { type: "json" };
import roomMemberSchema from "../../schemas/v1/room-member.schema.json" with { type: "json" };
import roomSchema from "../../schemas/v1/room.schema.json" with { type: "json" };
import threadSchema from "../../schemas/v1/thread.schema.json" with { type: "json" };
import { isCanonicalUtcTimestamp } from "../domain/timestamps.js";

export type ProtocolSchemaName =
  | "protocol"
  | "forum"
  | "local-config"
  | "member-profile"
  | "room-member"
  | "room"
  | "thread"
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
  forum: forumSchema,
  "local-config": localConfigSchema,
  "member-profile": memberProfileSchema,
  "room-member": roomMemberSchema,
  room: roomSchema,
  thread: threadSchema,
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
  let candidate = value;
  if (mode === "read" && value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const versionField = schemaName === "protocol" ? "protocolVersion" : "schemaVersion";
    const version = record[versionField];
    if (typeof version === "string" && /^1\.\d+$/u.test(version)) {
      candidate = { ...record, [versionField]: "1.0" };
    }
  }

  if (validator(candidate)) return { ok: true };
  const issues = toIssues(validator.errors).filter(
    (issue) => mode !== "read" || issue.keyword !== "additionalProperties",
  );
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
