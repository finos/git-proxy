/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
