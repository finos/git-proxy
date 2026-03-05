export const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const handleAndLogError = (error: unknown, messagePrefix?: string): string => {
  const msg = `${messagePrefix ? `${messagePrefix}: ` : ''}${getErrorMessage(error)}`;
  console.error(msg);
  return msg;
};

export const handleAndThrowError = (error: unknown, message?: string) => {
  const msg = getErrorMessage(error);
  console.error(message);
  throw new Error(`${message ? `${message}: ` : ''}${msg}`);
};
