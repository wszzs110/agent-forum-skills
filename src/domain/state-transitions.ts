export type LifecycleScope = "forum" | "room" | "thread";
export type LifecycleStatus = "active" | "archived" | "open" | "closed";

export const knownLifecycleEventTypes = [
  "forum-renamed",
  "forum-description-changed",
  "forum-archived",
  "forum-restored",
  "room-renamed",
  "room-description-changed",
  "room-archived",
  "room-restored",
  "thread-renamed",
  "thread-closed",
  "thread-reopened",
] as const;

const knownLifecycleEventTypeSet = new Set<string>(knownLifecycleEventTypes);

export function isKnownLifecycleEventType(value: string): boolean {
  return knownLifecycleEventTypeSet.has(value);
}

export interface LifecycleEventInput {
  scope: LifecycleScope;
  targetId: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ForumState {
  scope: "forum";
  id: string;
  name: string;
  description: string;
  status: "active" | "archived";
}

export interface RoomState {
  scope: "room";
  id: string;
  title: string;
  description: string;
  status: "active" | "archived";
}

export interface ThreadState {
  scope: "thread";
  id: string;
  title: string;
  status: "open" | "closed";
}

export type LifecycleState = ForumState | RoomState | ThreadState;

export class StateTransitionError extends Error {
  constructor(
    readonly code:
      | "EVENT_TARGET_MISMATCH"
      | "UNKNOWN_EVENT_TYPE"
      | "INVALID_EVENT_DATA"
      | "INVALID_STATE_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "StateTransitionError";
  }
}

function requiredText(
  data: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = data[field];
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new StateTransitionError(
      "INVALID_EVENT_DATA",
      `${field} must be a non-empty string with at most ${maxLength} characters`,
    );
  }
  return value;
}

function assertTarget(state: LifecycleState, event: LifecycleEventInput): void {
  if (state.scope !== event.scope || state.id !== event.targetId) {
    throw new StateTransitionError(
      "EVENT_TARGET_MISMATCH",
      `event target ${event.scope}:${event.targetId} does not match ${state.scope}:${state.id}`,
    );
  }
}

function archive<T extends ForumState | RoomState>(state: T): T {
  if (state.status === "archived") {
    throw new StateTransitionError(
      "INVALID_STATE_TRANSITION",
      `${state.scope} is already archived`,
    );
  }
  return { ...state, status: "archived" };
}

function restore<T extends ForumState | RoomState>(state: T): T {
  if (state.status === "active") {
    throw new StateTransitionError(
      "INVALID_STATE_TRANSITION",
      `${state.scope} is already active`,
    );
  }
  return { ...state, status: "active" };
}

export function applyLifecycleEvent<T extends LifecycleState>(
  state: T,
  event: LifecycleEventInput,
): T {
  assertTarget(state, event);

  if (state.scope === "forum") {
    const forum = state as ForumState;
    switch (event.type) {
      case "forum-renamed":
        return { ...forum, name: requiredText(event.data, "name", 200) } as T;
      case "forum-description-changed":
        return {
          ...forum,
          description: requiredText(event.data, "description", 2000),
        } as T;
      case "forum-archived":
        return archive(forum) as T;
      case "forum-restored":
        return restore(forum) as T;
      default:
        break;
    }
  }

  if (state.scope === "room") {
    const room = state as RoomState;
    switch (event.type) {
      case "room-renamed":
        return { ...room, title: requiredText(event.data, "title", 200) } as T;
      case "room-description-changed":
        return {
          ...room,
          description: requiredText(event.data, "description", 2000),
        } as T;
      case "room-archived":
        return archive(room) as T;
      case "room-restored":
        return restore(room) as T;
      default:
        break;
    }
  }

  if (state.scope === "thread") {
    const thread = state as ThreadState;
    switch (event.type) {
      case "thread-renamed":
        return { ...thread, title: requiredText(event.data, "title", 200) } as T;
      case "thread-closed":
        if (thread.status === "closed") {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "thread is already closed",
          );
        }
        return { ...thread, status: "closed" } as T;
      case "thread-reopened":
        if (thread.status === "open") {
          throw new StateTransitionError(
            "INVALID_STATE_TRANSITION",
            "thread is already open",
          );
        }
        return { ...thread, status: "open" } as T;
      default:
        break;
    }
  }

  throw new StateTransitionError(
    "UNKNOWN_EVENT_TYPE",
    `unsupported ${event.scope} event type: ${event.type}`,
  );
}
