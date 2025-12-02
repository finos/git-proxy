/**
 * API Configuration Service
 * Provides centralized access to API base URLs with caching
 */

import { getApiBaseUrl } from './runtime-config';

// Cache for the resolved API base URL
let cachedBaseUrl: string | null = null;
let baseUrlPromise: Promise<string> | null = null;

/**
 * Gets the API base URL with caching
 * The first call fetches from runtime config, subsequent calls return cached value
 * @return {Promise<string>} The API base URL
 */
export const getBaseUrl = async (): Promise<string> => {
  // Return cached value if available
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  // Reuse in-flight promise if one exists
  if (baseUrlPromise) {
    return baseUrlPromise;
  }

  // Fetch and cache the base URL
  baseUrlPromise = getApiBaseUrl()
    .then((url) => {
      cachedBaseUrl = url;
      return url;
    })
    .catch(() => {
      console.warn('Using default API base URL');
      cachedBaseUrl = location.origin;
      return location.origin;
    });

  return baseUrlPromise;
};

/**
 * Gets the API v1 base URL (baseUrl + /api/v1)
 * @return {Promise<string>} The API v1 base URL
 */
export const getApiV1BaseUrl = async (): Promise<string> => {
  const baseUrl = await getBaseUrl();
  return `${baseUrl}/api/v1`;
};

/**
 * Clears the cached base URL (useful for testing)
 */
export const clearCache = (): void => {
  cachedBaseUrl = null;
  baseUrlPromise = null;
};
