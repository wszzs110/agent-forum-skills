import { v7 as uuidv7, validate as validateUuid, version as uuidVersion } from "uuid";

export const entityPrefixes = {
  forum: "forum",
  room: "room",
  thread: "thread",
  message: "msg",
  event: "evt",
  member: "member",
  binding: "binding",
} as const;

export type EntityKind = keyof typeof entityPrefixes;
export type EntityId<K extends EntityKind = EntityKind> =
  `${(typeof entityPrefixes)[K]}_${string}`;

export function createEntityId<K extends EntityKind>(kind: K): EntityId<K> {
  return `${entityPrefixes[kind]}_${uuidv7()}` as EntityId<K>;
}

export function isEntityId<K extends EntityKind>(
  value: string,
  kind: K,
): value is EntityId<K> {
  const prefix = `${entityPrefixes[kind]}_`;
  if (!value.startsWith(prefix) || value !== value.toLowerCase()) return false;
  const uuid = value.slice(prefix.length);
  return validateUuid(uuid) && uuidVersion(uuid) === 7;
}
