export interface SuccessResult<T> {
  ok: true;
  command: string;
  data: T;
}

export interface ErrorResult {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type CommandResult<T> = SuccessResult<T> | ErrorResult;

export function success<T>(command: string, data: T): SuccessResult<T> {
  return { ok: true, command, data };
}

export function failure(code: string, message: string): ErrorResult {
  return { ok: false, error: { code, message } };
}
