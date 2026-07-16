import type { KnownMessageType } from "./message-types.js";

export const knownThreadKinds = [
  "discussion",
  "question",
  "proposal",
  "change",
  "blocker",
  "review",
  "status",
  "test-result",
] as const satisfies readonly KnownMessageType[];

export type KnownThreadKind = (typeof knownThreadKinds)[number];

const knownThreadKindSet = new Set<string>(knownThreadKinds);

export function isKnownThreadKind(value: string): value is KnownThreadKind {
  return knownThreadKindSet.has(value);
}
