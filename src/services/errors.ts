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
      | "REMOTE_URL_UNSAFE"
      | "REMOTE_ALREADY_CONFIGURED"
      | "REMOTE_DEFAULT_BRANCH_NOT_FOUND"
      | "REMOTE_PROTOCOL_INVALID"
      | "REMOTE_NOT_CONFIGURED"
      | "LOCAL_COMMITS_NOT_PUSHED"
      | "LOCAL_CLONE_CLEANUP_FAILED"
      | "ROOM_NOT_FOUND"
      | "ROOM_SLUG_EXISTS"
      | "ROOM_MEMBERSHIP_REQUIRED"
      | "ROOM_ARCHIVED"
      | "THREAD_NOT_FOUND"
      | "THREAD_KIND_INVALID"
      | "THREAD_CLOSED"
      | "MESSAGE_NOT_FOUND"
      | "MESSAGE_TYPE_INVALID"
      | "PROTOCOL_DATA_DAMAGED"
      | "NO_CHANGES",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
