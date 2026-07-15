export const ExitCode = {
  Success: 0,
  Unexpected: 1,
  Usage: 2,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
