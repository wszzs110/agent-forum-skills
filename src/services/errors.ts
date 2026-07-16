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
      | "NO_CHANGES",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
