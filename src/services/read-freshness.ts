import { loadLocalConfig } from "../config/local-config.js";
import { ServiceError } from "./errors.js";
import {
  refreshForumFromRemote,
  type ForumRefreshResult,
} from "./forum-sync.js";
import {
  createAgentForumPaths,
  type AgentForumPaths,
} from "../storage/paths.js";

export interface ReadFreshness {
  forumAlias: string;
  state: "fresh" | "stale";
  source: "remote" | "local-cache" | "local-only";
  refresh?: ForumRefreshResult;
  error?: { code: string; message: string };
}

/**
 * 读取默认追求最新；远端不可用时保留可读的本地快照，并明确标成 stale。
 * 这里绝不调用会 push 的 syncForum，避免查询意外发布本地提交。
 */
export async function refreshForRead(
  forumAlias: string,
  options: { noSync?: boolean } = {},
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ReadFreshness> {
  if (options.noSync) {
    return { forumAlias, state: "stale", source: "local-cache" };
  }
  try {
    const refresh = await refreshForumFromRemote(forumAlias, paths);
    if (refresh.outcome === "remote-not-configured") {
      return { forumAlias, state: "stale", source: "local-only", refresh };
    }
    if (refresh.outcome === "skipped-local-commits") {
      return { forumAlias, state: "stale", source: "local-cache", refresh };
    }
    return { forumAlias, state: "fresh", source: "remote", refresh };
  } catch (error) {
    return {
      forumAlias,
      state: "stale",
      source: "local-cache",
      error: {
        code: error instanceof ServiceError ? error.code : "SYNC_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function refreshAllForRead(
  options: { noSync?: boolean } = {},
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<ReadFreshness[]> {
  const config = await loadLocalConfig(paths);
  const results: ReadFreshness[] = [];
  for (const forum of [...config.forums].sort((left, right) => left.alias.localeCompare(right.alias))) {
    results.push(await refreshForRead(forum.alias, options, paths));
  }
  return results;
}
