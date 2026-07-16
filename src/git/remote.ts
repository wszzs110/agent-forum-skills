import { isAbsolute } from "node:path";
import { ServiceError } from "../services/errors.js";

export interface SafeRemote {
  value: string;
  display: string;
  kind: "network" | "local";
}

export function validateRemoteUrl(value: string): SafeRemote {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ServiceError("REMOTE_URL_UNSAFE", "remote URL must not be empty");
  }
  if (trimmed.startsWith("-")) {
    throw new ServiceError(
      "REMOTE_URL_UNSAFE",
      "remote URL must not begin with a command-line option prefix",
    );
  }
  if (isAbsolute(trimmed) || trimmed.startsWith(".")) {
    return { value: trimmed, display: "<local-path>", kind: "local" };
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:", "ssh:", "git:", "file:"].includes(url.protocol)) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        `unsupported remote URL protocol: ${url.protocol}`,
      );
    }
    if (url.search || url.hash) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "remote URL must not contain query parameters or fragments; use credential configuration outside the URL",
      );
    }
    if (url.password) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "remote URL must not contain a password or token; use a credential helper or SSH agent",
      );
    }
    if ((url.protocol === "http:" || url.protocol === "https:") && url.username) {
      throw new ServiceError(
        "REMOTE_URL_UNSAFE",
        "HTTP(S) remote URL must not contain user information; use a credential helper",
      );
    }
    if (url.protocol === "file:") {
      return { value: trimmed, display: "<local-path>", kind: "local" };
    }
    const display = new URL(url.toString());
    display.password = "";
    return { value: trimmed, display: display.toString(), kind: "network" };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }

  const scp = /^(?:([^@\s]+)@)?([^:/\s]+):(.+)$/u.exec(trimmed);
  if (scp && !/^[a-zA-Z]:[\\/]/u.test(trimmed)) {
    return { value: trimmed, display: trimmed, kind: "network" };
  }

  if (trimmed.endsWith(".git")) {
    return { value: trimmed, display: "<local-path>", kind: "local" };
  }
  throw new ServiceError(
    "REMOTE_URL_UNSAFE",
    "remote must be a supported URL, SCP-style SSH remote, or local Git path",
  );
}

export function displayRemoteUrl(value: string): string {
  try {
    return validateRemoteUrl(value).display;
  } catch {
    return "<redacted-remote>";
  }
}
