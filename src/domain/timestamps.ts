const utcTimestampWithMilliseconds =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u;

export function isCanonicalUtcTimestamp(value: string): boolean {
  if (!utcTimestampWithMilliseconds.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

export function currentUtcTimestamp(now = new Date()): string {
  return now.toISOString();
}
