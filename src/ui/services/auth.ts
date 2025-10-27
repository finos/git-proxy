import { getCookie } from '../utils';
import { PublicUser } from '../../db/types';
import { AxiosError } from 'axios';
import { getBaseUrl } from './apiConfig';

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
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      credentials: 'include', // Sends cookies
    });
    if (!response.ok) throw new Error(`Failed to fetch user info: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
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
export const processAuthError = (error: AxiosError<any>, jwtAuthEnabled = false): string => {
  const errorMessage = (error.response?.data as any)?.message ?? 'Unknown error';
  let msg = `Failed to authorize user: ${errorMessage.trim()}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    msg += 'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    msg += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return msg;
};
