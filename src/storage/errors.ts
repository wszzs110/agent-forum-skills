export class StorageError extends Error {
  constructor(
    readonly code:
      | "INVALID_LOCAL_ALIAS"
      | "INVALID_FORUM_ID"
      | "PATH_OUTSIDE_ROOT"
      | "SCHEMA_VALIDATION_FAILED"
      | "UNKNOWN_MESSAGE_TYPE"
      | "UNKNOWN_EVENT_TYPE"
      | "INVALID_MESSAGE_BODY"
      | "PATH_ID_MISMATCH"
      | "IMMUTABLE_PATH_EXISTS"
      | "LOCAL_LOCKED"
      | "LOCK_OWNERSHIP_LOST"
      | "LOCK_NOT_STALE",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
