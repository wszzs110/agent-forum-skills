import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { currentUtcTimestamp, isCanonicalUtcTimestamp } from "../domain/timestamps.js";
import { StorageError } from "./errors.js";

export interface LockOwner {
  token: string;
  pid: number;
  hostname: string;
  command: string;
  startedAt: string;
}

export interface ForumLockHandle {
  path: string;
  owner: LockOwner;
  release: () => Promise<void>;
}

export interface AcquireLockOptions {
  lockPath: string;
  command: string;
  staleAfterMs?: number;
  now?: Date;
  pid?: number;
  hostname?: string;
  isProcessAlive?: (pid: number) => boolean;
}

const ownerFileName = "owner.json";

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EPERM",
    );
  }
}

async function readOwner(lockPath: string): Promise<LockOwner | undefined> {
  try {
    const value = JSON.parse(
      await readFile(resolve(lockPath, ownerFileName), "utf8"),
    ) as Partial<LockOwner>;
    if (
      typeof value.token !== "string" ||
      typeof value.pid !== "number" ||
      typeof value.hostname !== "string" ||
      typeof value.command !== "string" ||
      typeof value.startedAt !== "string" ||
      !isCanonicalUtcTimestamp(value.startedAt)
    ) {
      return undefined;
    }
    return value as LockOwner;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error instanceof SyntaxError)
    ) {
      return undefined;
    }
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function lockAgeMs(
  lockPath: string,
  owner: LockOwner | undefined,
  now: Date,
): Promise<number> {
  if (owner) return now.valueOf() - new Date(owner.startedAt).valueOf();
  try {
    return now.valueOf() - (await stat(lockPath)).mtimeMs;
  } catch (error) {
    // 锁目录可能刚被并发获取方删除（writeFile 失败回滚或正常释放），
    // 此时视为已释放（0ms），让外层 stale 检查直接重试，而不是让 stat 抛 ENOENT。
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return 0;
    }
    throw error;
  }
}

async function removeStaleLock(lockPath: string): Promise<void> {
  const quarantine = `${lockPath}.stale-${randomUUID()}`;
  await rename(lockPath, quarantine);
  await rm(quarantine, { recursive: true, force: true });
}

export async function acquireForumLock(
  options: AcquireLockOptions,
): Promise<ForumLockHandle> {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? 10 * 60 * 1000;
  const currentHostname = options.hostname ?? hostname();
  const currentPid = options.pid ?? process.pid;
  const isProcessAlive = options.isProcessAlive ?? defaultProcessAlive;
  const owner: LockOwner = {
    token: randomUUID(),
    pid: currentPid,
    hostname: currentHostname,
    command: options.command,
    startedAt: currentUtcTimestamp(now),
  };

  await mkdir(dirname(options.lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(options.lockPath, { mode: 0o700 });
      try {
        await writeFile(
          resolve(options.lockPath, ownerFileName),
          `${JSON.stringify(owner, null, 2)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 },
        );
      } catch (error) {
        await rm(options.lockPath, { recursive: true, force: true });
        throw error;
      }

      return {
        path: options.lockPath,
        owner,
        release: async () => {
          const current = await readOwner(options.lockPath);
          if (!current || current.token !== owner.token) {
            throw new StorageError(
              "LOCK_OWNERSHIP_LOST",
              `lock ownership changed before release: ${options.lockPath}`,
            );
          }
          await rm(options.lockPath, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }

      const existing = await readOwner(options.lockPath);
      // 锁目录刚被并发获取方删除（writeFile 失败回滚或正常释放）时，
      // 直接重试获取，而不是误报 LOCAL_LOCKED。
      if (existing === undefined) {
        try {
          await stat(options.lockPath);
        } catch (statError) {
          if (
            statError &&
            typeof statError === "object" &&
            "code" in statError &&
            statError.code === "ENOENT"
          ) {
            continue;
          }
          throw statError;
        }
      }
      const age = await lockAgeMs(options.lockPath, existing, now);
      const sameHost = !existing || existing.hostname === currentHostname;
      const alive = existing && sameHost ? isProcessAlive(existing.pid) : false;
      // 同一主机上 PID 已不存在时，该进程不可能继续持有目录锁；立即回收可避免
      // 外层超时或崩溃后，用户还必须等待固定 stale 时间才能重试。
      const removable = sameHost && !alive && (existing !== undefined || age >= staleAfterMs);
      if (attempt === 0 && removable) {
        try {
          await removeStaleLock(options.lockPath);
          continue;
        } catch (staleError) {
          if (
            staleError &&
            typeof staleError === "object" &&
            "code" in staleError &&
            staleError.code === "ENOENT"
          ) {
            continue;
          }
          throw staleError;
        }
      }

      throw new StorageError(
        "LOCAL_LOCKED",
        `forum write lock is already held: ${options.lockPath}`,
        existing ? { ...existing, token: undefined } : { ageMs: age },
      );
    }
  }

  throw new StorageError(
    "LOCAL_LOCKED",
    `forum write lock could not be acquired: ${options.lockPath}`,
  );
}

export async function withForumLock<T>(
  options: AcquireLockOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const lock = await acquireForumLock(options);
  try {
    return await operation();
  } finally {
    await lock.release();
  }
}

export async function clearStaleForumLock(
  options: Omit<AcquireLockOptions, "command">,
): Promise<boolean> {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? 10 * 60 * 1000;
  const currentHostname = options.hostname ?? hostname();
  const isProcessAlive = options.isProcessAlive ?? defaultProcessAlive;
  let owner;
  try {
    owner = await readOwner(options.lockPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  let age;
  try {
    age = await lockAgeMs(options.lockPath, owner, now);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  const sameHost = !owner || owner.hostname === currentHostname;
  const alive = owner && sameHost ? isProcessAlive(owner.pid) : false;
  // 有可识别 owner 且同机 PID 已死亡时可立即安全回收；缺少 owner 的残缺锁仍保守等待。
  const removable = sameHost && !alive && (owner !== undefined || age >= staleAfterMs);
  if (!removable) {
    throw new StorageError(
      "LOCK_NOT_STALE",
      `lock is not safe to clear: ${options.lockPath}`,
    );
  }
  await removeStaleLock(options.lockPath);
  return true;
}
