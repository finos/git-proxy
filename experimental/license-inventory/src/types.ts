export type ResultError = {
  error: Error;
  data: null;
};
export type ResultSuccess<T> = {
  error: null;
  data: T;
};

export type Result<T> = ResultError | ResultSuccess<T>;
export type AsyncResult<T> = Promise<Result<T>>;

export const resultIsFailure = <T>(r: Result<T>): r is ResultError => r.error !== null;
export const resultIsSuccess = <T>(r: Result<T>): r is ResultSuccess<T> => r.error === null;
