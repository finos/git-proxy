import { getCookie } from '../utils';
import { PublicUser } from '../../db/types';
import { API_BASE } from '../apiBase';
import { AxiosError } from 'axios';

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
    const response = await fetch(`${API_BASE}/api/auth/profile`, {
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
  let errorMessage = `Failed to authorize user: ${error.response?.data?.trim() ?? ''}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    errorMessage +=
      'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    errorMessage += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return errorMessage;
};
