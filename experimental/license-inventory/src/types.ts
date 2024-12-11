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
