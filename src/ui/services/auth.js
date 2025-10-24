import { getCookie } from '../utils';

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}`
  : `${location.origin}`;

/**
 * Gets the current user's information
 * @return {Promise<Object>} The user's information
 */
export const getUserInfo = async () => {
  try {
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
 * @return {Object} The Axios config
 */
export const getAxiosConfig = () => {
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
 * @param {Object} error - The error object
 * @return {string} The error message
 */
export const processAuthError = (error, jwtAuthEnabled = false) => {
  let errorMessage = `Failed to authorize user: ${error.response.data.trim()}. `;
  if (jwtAuthEnabled && !localStorage.getItem('ui_jwt_token')) {
    errorMessage +=
      'Set your JWT token in the settings page or disable JWT auth in your app configuration.';
  } else {
    errorMessage += 'Check your JWT token or disable JWT auth in your app configuration.';
  }
  return errorMessage;
};
