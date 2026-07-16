import { basename, resolve } from "node:path";
import { isKnownMessageType } from "../domain/message-types.js";
import { isKnownLifecycleEventType } from "../domain/state-transitions.js";
import type { ProtocolSchemaName } from "../protocol/validator.js";
import {
  createImmutableDirectory,
  writeFileAtomic,
  writeValidatedJsonAtomic,
} from "./atomic.js";
import { StorageError } from "./errors.js";

export async function createImmutableDocument(
  destination: string,
  schema: ProtocolSchemaName,
  value: unknown,
): Promise<void> {
  await writeValidatedJsonAtomic(destination, schema, value, {
    overwrite: false,
  });
}

export async function createImmutableMessage(
  destination: string,
  metadata: unknown,
  body: string,
): Promise<void> {
  if (body.trim().length === 0 || body.includes("\0")) {
    throw new StorageError(
      "INVALID_MESSAGE_BODY",
      "message body must be non-empty and must not contain NUL",
    );
  }
  if (
    metadata &&
    typeof metadata === "object" &&
    "id" in metadata &&
    typeof metadata.id === "string" &&
    basename(destination) !== metadata.id
  ) {
    throw new StorageError(
      "PATH_ID_MISMATCH",
      `message path does not match metadata ID: ${destination}`,
    );
  }
  if (
    metadata &&
    typeof metadata === "object" &&
    "type" in metadata &&
    typeof metadata.type === "string" &&
    !isKnownMessageType(metadata.type)
  ) {
    throw new StorageError(
      "UNKNOWN_MESSAGE_TYPE",
      `current writer cannot publish message type: ${metadata.type}`,
    );
  }
  await createImmutableDirectory(destination, async (temporaryDirectory) => {
    await writeValidatedJsonAtomic(
      resolve(temporaryDirectory, "message.json"),
      "message",
      metadata,
    );
    await writeFileAtomic(resolve(temporaryDirectory, "body.md"), body);
  });
}

export async function createImmutableEvent(
  destination: string,
  event: unknown,
): Promise<void> {
  if (
    event &&
    typeof event === "object" &&
    "id" in event &&
    typeof event.id === "string" &&
    basename(destination) !== event.id
  ) {
    throw new StorageError(
      "PATH_ID_MISMATCH",
      `event path does not match event ID: ${destination}`,
    );
  }
  if (
    event &&
    typeof event === "object" &&
    "type" in event &&
    typeof event.type === "string" &&
    !isKnownLifecycleEventType(event.type)
  ) {
    throw new StorageError(
      "UNKNOWN_EVENT_TYPE",
      `current writer cannot publish lifecycle event type: ${event.type}`,
    );
  }
  await createImmutableDirectory(destination, async (temporaryDirectory) => {
    await writeValidatedJsonAtomic(
      resolve(temporaryDirectory, "event.json"),
      "event",
      event,
    );
  });
}
