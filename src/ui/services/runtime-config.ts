/**
 * Runtime configuration service
 * Fetches configuration that can be set at deployment time
 */

interface RuntimeConfig {
  apiUrl?: string;
  allowedOrigins?: string[];
  environment?: string;
}

let runtimeConfig: RuntimeConfig | null = null;

/**
 * Fetches the runtime configuration
 * @return {Promise<RuntimeConfig>} Runtime configuration
 */
export const getRuntimeConfig = async (): Promise<RuntimeConfig> => {
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

  return runtimeConfig as RuntimeConfig;
};

/**
 * Gets the API base URL with intelligent fallback
 * @return {Promise<string>} The API base URL
 */
export const getApiBaseUrl = async (): Promise<string> => {
  const config = await getRuntimeConfig();

  // Priority order:
  // 1. Runtime config apiUrl (set at deployment)
  // 2. Build-time environment variable
  // 3. Auto-detect from current location with smart defaults
  if (config.apiUrl) {
    return config.apiUrl;
  }

  // @ts-expect-error - import.meta.env is available in Vite but not in CommonJS tsconfig
  if (import.meta.env?.VITE_API_URI) {
    // @ts-expect-error - Vite env variable
    return import.meta.env.VITE_API_URI as string;
  }

  // Check if running in browser environment (not Node.js tests)
  if (typeof location !== 'undefined') {
    // Smart defaults based on current location
    const currentHost = location.hostname;
    if (currentHost === 'localhost' && location.port === '3000') {
      // Development mode: Vite dev server, API on port 8080
      console.log('Development mode detected: using localhost:8080 for API');
      return 'http://localhost:8080';
    }

    // Production mode or other scenarios: API on same origin
    return location.origin;
  }

  // Fallback for Node.js/test environment
  return 'http://localhost:8080';
};

/**
 * Gets allowed origins for CORS
 * @return {Promise<string[]>} Array of allowed origins
 */
export const getAllowedOrigins = async (): Promise<string[]> => {
  const config = await getRuntimeConfig();
  return config.allowedOrigins || ['*'];
};
