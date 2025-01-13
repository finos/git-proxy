export type Result<T> =
  | {
      error: Error;
      data: null;
    }
  | {
      error: null;
      data: T;
    };
export type AsyncResult<T> = Promise<Result<T>>;

export const resultIsFailure = <T>(
  r: Result<T>,
): r is {
  error: Error;
  data: null;
} => r.error !== null;
export const resultIsSuccess = <T>(
  r: Result<T>,
): r is {
  error: null;
  data: T;
} => r.error === null;
