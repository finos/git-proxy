export interface ServiceResult<T = void> {
  success: boolean;
  status?: number;
  message?: string;
  data?: T;
}

export const getServiceError = (
  error: any,
  fallbackMessage: string,
): { status?: number; message: string } => {
  const status = error?.response?.status;
  const responseMessage = error?.response?.data?.message;
  const message =
    typeof responseMessage === 'string' && responseMessage.trim().length > 0
      ? responseMessage
      : status
        ? `Unknown error occurred, response code: ${status}`
        : error?.message || fallbackMessage;
  return { status, message };
};

export const formatErrorMessage = (
  prefix: string,
  status: number | undefined,
  message: string,
): string => `${prefix}: ${status ? `${status} ` : ''}${message}`;

export const errorResult = <T = void>(error: any, fallbackMessage: string): ServiceResult<T> => {
  const { status, message } = getServiceError(error, fallbackMessage);
  return { success: false, status, message };
};

export const successResult = <T = void>(data?: T): ServiceResult<T> => ({
  success: true,
  ...(data !== undefined && { data }),
});
