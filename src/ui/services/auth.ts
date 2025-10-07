import { getCookie } from '../utils';
import { PublicUser } from '../../db/types';
import { API_BASE } from '../apiBase';
import { AxiosError } from 'axios';
import { getApiBaseUrl } from './runtime-config.js';

interface AxiosConfig {
  withCredentials: boolean;
  headers: {
    'X-CSRF-TOKEN': string;
    Authorization?: string;
  };
}

// Initialize baseUrl - will be set async
let baseUrl = location.origin; // Default fallback

// Set the actual baseUrl from runtime config
getApiBaseUrl()
  .then((apiUrl) => {
    baseUrl = apiUrl;
  })
  .catch(() => {
    // Keep the default if runtime config fails
    console.warn('Using default API base URL for auth');
  });

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
  const errorMessage = (error.response?.data as any)?.message ?? 'Unknown error';
  let msg = `Failed to authorize user: ${errorMessage.trim()}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    msg += 'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    msg += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return msg;
};
