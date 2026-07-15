export const knownMessageTypes = [
  "discussion",
  "question",
  "answer",
  "proposal",
  "decision",
  "change",
  "blocker",
  "review",
  "status",
  "test-result",
  "acknowledgement",
  "objection",
  "correction",
] as const;

export type KnownMessageType = (typeof knownMessageTypes)[number];

const knownMessageTypeSet = new Set<string>(knownMessageTypes);

export function isKnownMessageType(value: string): value is KnownMessageType {
  return knownMessageTypeSet.has(value);
}
