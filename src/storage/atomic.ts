import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  validateProtocolDocument,
  type ProtocolSchemaName,
} from "../protocol/validator.js";
import { StorageError } from "./errors.js";

const temporaryPrefix = ".agent-forum-tmp-";

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writeFileAtomic(
  destination: string,
  content: string | Uint8Array,
  options: { overwrite?: boolean; mode?: number } = {},
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(
    dirname(destination),
    `${temporaryPrefix}${randomUUID()}`,
  );
  let handle;
  try {
    handle = await open(temporary, "wx", options.mode ?? 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;

    if (options.overwrite) {
      await rename(temporary, destination);
    } else {
      // 同级 hard link 提供原子的 no-replace 语义，避免并发检查后覆盖不可变文件。
      await link(temporary, destination);
      await rm(temporary, { force: true });
    }
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true });
    if (
      !options.overwrite &&
      !(error instanceof StorageError) &&
      (await pathExists(destination))
    ) {
      throw new StorageError(
        "IMMUTABLE_PATH_EXISTS",
        `immutable path already exists: ${destination}`,
      );
    }
    throw error;
  }
}

export async function writeJsonAtomic(
  destination: string,
  value: unknown,
  options: { overwrite?: boolean; mode?: number } = {},
): Promise<void> {
  await writeFileAtomic(
    destination,
    `${JSON.stringify(value, null, 2)}\n`,
    options,
  );
}

export async function writeValidatedJsonAtomic(
  destination: string,
  schema: ProtocolSchemaName,
  value: unknown,
  options: { overwrite?: boolean; mode?: number } = {},
): Promise<void> {
  const validation = validateProtocolDocument(schema, value, { mode: "write" });
  if (!validation.ok) {
    throw new StorageError(
      "SCHEMA_VALIDATION_FAILED",
      `document does not satisfy the ${schema} schema`,
      validation.issues,
    );
  }
  await writeJsonAtomic(destination, value, options);
}

export async function createImmutableDirectory(
  destination: string,
  writer: (temporaryDirectory: string) => Promise<void>,
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  if (await pathExists(destination)) {
    throw new StorageError(
      "IMMUTABLE_PATH_EXISTS",
      `immutable directory already exists: ${destination}`,
    );
  }

  const temporary = resolve(
    dirname(destination),
    `${temporaryPrefix}${randomUUID()}`,
  );
  try {
    await mkdir(temporary, { mode: 0o700 });
    await writer(temporary);
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (
      !(error instanceof StorageError) &&
      (await pathExists(destination))
    ) {
      throw new StorageError(
        "IMMUTABLE_PATH_EXISTS",
        `immutable directory already exists: ${destination}`,
      );
    }
    throw error;
  }
}

export async function cleanupTemporaryEntries(
  parentDirectory: string,
  options: { olderThanMs: number; now?: number },
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(parentDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const now = options.now ?? Date.now();
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(temporaryPrefix)) continue;
    const candidate = resolve(parentDirectory, entry.name);
    const information = await lstat(candidate);
    if (now - information.mtimeMs < options.olderThanMs) continue;
    await rm(candidate, { recursive: entry.isDirectory(), force: true });
    removed.push(candidate);
  }
  return removed;
}
