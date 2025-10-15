/**
 * Runtime configuration service
 * Fetches configuration that can be set at deployment time
 */

let runtimeConfig = null;

/**
 * Fetches the runtime configuration
 * @return {Promise<Object>} Runtime configuration
 */
export const getRuntimeConfig = async () => {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  try {
    const response = await fetch('/runtime-config.json');
    if (response.ok) {
      runtimeConfig = await response.json();
      console.log('Loaded runtime config:', runtimeConfig);
    } else {
      console.warn('Runtime config not found, using defaults');
      runtimeConfig = {};
    }
  } catch (error) {
    console.warn('Failed to load runtime config:', error);
    runtimeConfig = {};
  }

  return runtimeConfig;
};

/**
 * Gets the API base URL with intelligent fallback
 * @return {Promise<string>} The API base URL
 */
export const getApiBaseUrl = async () => {
  const config = await getRuntimeConfig();

  // Priority order:
  // 1. Runtime config apiUrl (set at deployment)
  // 2. Build-time environment variable
  // 3. Auto-detect from current location
  if (config.apiUrl) {
    return config.apiUrl;
  }

  if (import.meta.env.VITE_API_URI) {
    return import.meta.env.VITE_API_URI;
  }

  return location.origin;
};

/**
 * Gets allowed origins for CORS
 * @return {Promise<string[]>} Array of allowed origins
 */
export const getAllowedOrigins = async () => {
  const config = await getRuntimeConfig();
  return config.allowedOrigins || ['*'];
};
