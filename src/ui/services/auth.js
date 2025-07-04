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
