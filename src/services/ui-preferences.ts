import { readFile } from "node:fs/promises";
import { currentUtcTimestamp } from "../domain/timestamps.js";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { ServiceError } from "./errors.js";

export type UiLanguage = "en" | "zh";

interface UiPreferences {
  formatVersion: 1;
  language: UiLanguage;
  updatedAt: string;
}

function systemLanguage(): UiLanguage {
  return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function validPreferences(value: unknown): value is UiPreferences {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.formatVersion === 1 && (item.language === "en" || item.language === "zh") && typeof item.updatedAt === "string" && !Number.isNaN(Date.parse(item.updatedAt));
}

export async function getUiLanguage(paths: AgentForumPaths = createAgentForumPaths()): Promise<UiLanguage> {
  try {
    const value = JSON.parse(await readFile(paths.uiPreferencesFile, "utf8"));
    if (!validPreferences(value)) throw new ServiceError("PROTOCOL_DATA_DAMAGED", "UI preferences are invalid");
    return value.language;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return systemLanguage();
    throw error;
  }
}

export async function setUiLanguage(language: UiLanguage, paths: AgentForumPaths = createAgentForumPaths()): Promise<{ language: UiLanguage }> {
  if (language !== "en" && language !== "zh") throw new ServiceError("PROTOCOL_DATA_DAMAGED", "UI language must be en or zh");
  const lock = await acquireForumLock({ lockPath: `${paths.uiPreferencesFile}.lock`, command: "UI language preference" });
  try {
    await writeJsonAtomic(paths.uiPreferencesFile, { formatVersion: 1, language, updatedAt: currentUtcTimestamp() }, { overwrite: true, mode: 0o600 });
    return { language };
  } finally {
    await lock.release();
  }
}
