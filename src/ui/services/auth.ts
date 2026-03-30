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

import { AxiosError } from 'axios';
import { getCookie } from '../utils';
import { PublicUser } from '../../db/types';
import { BackendResponse } from '../types';
import { getBaseUrl } from './apiConfig';
import { getErrorMessage } from '../../utils/errors';

interface AxiosConfig {
  withCredentials: boolean;
  headers: {
    'X-CSRF-TOKEN': string;
    Authorization?: string;
  };
}

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Gets the current user's information
 */
export const getUserInfo = async (): Promise<PublicUser | null> => {
  try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/profile`, {
      credentials: 'include', // Sends cookies
    });
    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: unknown) {
    if (IS_DEV) {
      console.warn('Error fetching user info:', getErrorMessage(error));
    }
    return null;
  }
};

/**
 * Gets the Axios config for the UI
 */
export const getAxiosConfig = (): AxiosConfig => {
  const jwtToken = localStorage.getItem('ui_jwt_token');
  return {
    withCredentials: true,
    headers: {
      'X-CSRF-TOKEN': getCookie('csrf') || '',
      Authorization: jwtToken ? `Bearer ${jwtToken}` : undefined,
    },
  };
};

/**
 * Processes authentication errors and returns a user-friendly error message
 */
export const processAuthError = (
  error: AxiosError<BackendResponse>,
  jwtAuthEnabled = false,
): string => {
  const errorMessage = error.response?.data?.message?.trim() ?? 'Unknown error';
  let msg = `Failed to authorize user: ${errorMessage}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    msg += 'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    msg += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return msg;
};
