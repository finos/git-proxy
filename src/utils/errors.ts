export const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const handleAndLogError = (error: unknown, message: string): string => {
  const msg = `${message}: ${getErrorMessage(error)}`;
  console.error(msg);
  return msg;
};

export const handleAndThrowError = (error: unknown, message: string) => {
  const msg = getErrorMessage(error);
  console.error(message);
  throw new Error(`${message}: ${msg}`);
};
