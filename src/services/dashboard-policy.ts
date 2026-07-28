import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { writeJsonAtomic } from "../storage/atomic.js";
import { acquireForumLock } from "../storage/lock.js";
import { createAgentForumPaths, type AgentForumPaths } from "../storage/paths.js";
import { ServiceError } from "./errors.js";

/** Dashboard 二进制获取只由本机用户策略控制，绝不写入 Forum。 */
export type DashboardAcquisitionPolicy = "managed" | "ask" | "manual";

export interface DashboardAcquisitionPolicyState {
  formatVersion: 1;
  policy: DashboardAcquisitionPolicy;
  updatedAt: string;
}

const policyValues = new Set<DashboardAcquisitionPolicy>(["managed", "ask", "manual"]);

function defaultState(): DashboardAcquisitionPolicyState {
  return { formatVersion: 1, policy: "ask", updatedAt: "1970-01-01T00:00:00.000Z" };
}

function parseState(value: unknown): DashboardAcquisitionPolicyState {
  if (!value || typeof value !== "object") throw new ServiceError("DASHBOARD_POLICY_INVALID", "Dashboard acquisition policy must be an object");
  const state = value as Record<string, unknown>;
  if (
    Object.keys(state).length !== 3 ||
    state.formatVersion !== 1 ||
    typeof state.policy !== "string" ||
    !policyValues.has(state.policy as DashboardAcquisitionPolicy) ||
    typeof state.updatedAt !== "string" ||
    Number.isNaN(Date.parse(state.updatedAt))
  ) {
    throw new ServiceError("DASHBOARD_POLICY_INVALID", "Dashboard acquisition policy is invalid");
  }
  return state as unknown as DashboardAcquisitionPolicyState;
}

export async function getDashboardAcquisitionPolicy(
  paths: AgentForumPaths = createAgentForumPaths(),
): Promise<DashboardAcquisitionPolicyState> {
  try {
    return parseState(JSON.parse(await readFile(paths.dashboardPolicyFile, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return defaultState();
    throw error;
  }
}

export async function setDashboardAcquisitionPolicy(
  policy: DashboardAcquisitionPolicy,
  paths: AgentForumPaths = createAgentForumPaths(),
  now = new Date(),
): Promise<DashboardAcquisitionPolicyState> {
  if (!policyValues.has(policy)) throw new ServiceError("DASHBOARD_POLICY_INVALID", `unknown Dashboard acquisition policy: ${policy}`);
  const lock = await acquireForumLock({
    lockPath: resolve(paths.locksDirectory, "dashboard-policy.lock"),
    command: "dashboard policy set",
  });
  try {
    const state: DashboardAcquisitionPolicyState = { formatVersion: 1, policy, updatedAt: now.toISOString() };
    await writeJsonAtomic(paths.dashboardPolicyFile, state, { overwrite: true, mode: 0o600 });
    return state;
  } finally {
    await lock.release();
  }
}
