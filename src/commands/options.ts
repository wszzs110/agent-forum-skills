export interface ParsedCommandOptions {
  values: Map<string, string>;
  multiValues: Map<string, string[]>;
  flags: Set<string>;
}

export function parseCommandOptions(
  args: readonly string[],
  definitions: {
    values: readonly string[];
    repeatableValues?: readonly string[];
    flags?: readonly string[];
  },
): ParsedCommandOptions | { error: string } {
  const valueOptions = new Set(definitions.values);
  const repeatableValueOptions = new Set(definitions.repeatableValues ?? []);
  const flagOptions = new Set(definitions.flags ?? []);
  const values = new Map<string, string>();
  const multiValues = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      return { error: `unexpected positional argument: ${argument ?? ""}` };
    }
    if (flagOptions.has(argument)) {
      if (flags.has(argument)) return { error: `duplicate option: ${argument}` };
      flags.add(argument);
      continue;
    }
    if (
      !valueOptions.has(argument) &&
      !repeatableValueOptions.has(argument)
    ) {
      return { error: `unknown option: ${argument}` };
    }
    if (valueOptions.has(argument) && values.has(argument)) {
      return { error: `duplicate option: ${argument}` };
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      return { error: `${argument} requires a value` };
    }
    if (repeatableValueOptions.has(argument)) {
      const existing = multiValues.get(argument) ?? [];
      existing.push(value);
      multiValues.set(argument, existing);
    } else {
      values.set(argument, value);
    }
    index += 1;
  }

  return { values, multiValues, flags };
}

export function requireOption(
  parsed: ParsedCommandOptions,
  name: string,
): string | { error: string } {
  const value = parsed.values.get(name);
  return value === undefined ? { error: `${name} is required` } : value;
}
