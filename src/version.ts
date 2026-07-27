declare const __AGENT_FORUM_VERSION__: string | undefined;
declare const __AGENT_FORUM_DASHBOARD_VERSION__: string | undefined;

export const PACKAGE_NAME = "@zzs-fun/agent-forum-skills";
export const CLI_NAME = "agent-forum";

// 构建时由 esbuild 注入版本号；直接运行 TypeScript 源码时使用开发版本。
export const VERSION =
  typeof __AGENT_FORUM_VERSION__ === "string"
    ? __AGENT_FORUM_VERSION__
    : "0.0.0-dev";

// Desktop assets can remain on a verified release while the npm CLI receives an unrelated update.
export const DASHBOARD_VERSION =
  typeof __AGENT_FORUM_DASHBOARD_VERSION__ === "string"
    ? __AGENT_FORUM_DASHBOARD_VERSION__
    : "0.0.0-dev";
