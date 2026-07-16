export class ServiceError extends Error {
  constructor(
    readonly code:
      | "IDENTITY_NOT_FOUND"
      | "IDENTITY_EXISTS"
      | "DEFAULT_IDENTITY_REQUIRED"
      | "FORUM_ALIAS_EXISTS"
      | "FORUM_NOT_FOUND"
      | "FORUM_PATH_EXISTS"
      | "FORUM_PROTOCOL_MISMATCH"
      | "FORUM_MEMBERSHIP_REQUIRED"
      | "ROOM_NOT_FOUND"
      | "ROOM_SLUG_EXISTS"
      | "ROOM_MEMBERSHIP_REQUIRED"
      | "ROOM_ARCHIVED"
      | "THREAD_NOT_FOUND"
      | "THREAD_KIND_INVALID"
      | "PROTOCOL_DATA_DAMAGED"
      | "NO_CHANGES",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
