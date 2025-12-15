import { AxiosError } from 'axios';
import { getCookie } from '../utils';
import { PublicUser } from '../../db/types';
import { API_BASE } from '../apiBase';
import { BackendResponse } from '../types';

interface AxiosConfig {
  withCredentials: boolean;
  headers: {
    'X-CSRF-TOKEN': string;
    Authorization?: string;
  };
}

/**
 * Gets the current user's information
 */
export const getUserInfo = async (): Promise<PublicUser | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include', // Sends cookies
    });
    if (!response.ok) throw new Error(`Failed to fetch user info: ${response.statusText}`);
    return await response.json();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching user info:', msg);
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
  let errorMessage = `Failed to authorize user: ${error.response?.data?.message?.trim() ?? ''}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    errorMessage +=
      'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    errorMessage += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return errorMessage;
};
