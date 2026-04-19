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
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      runtimeConfig = await response.json();
      console.log('Loaded runtime config:', runtimeConfig);
    } else if (response.ok) {
      console.warn('Runtime config is not JSON, using defaults');
      runtimeConfig = {};
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
  // 2. Build-time VITE_API_URI (.env.development usually points at Express, e.g. http://localhost:8080)
  // 3. Vite dev on localhost:3000 → same origin; vite.config must proxy /api → git-proxy HTTP port
  // 4. Browser: same origin; Node/tests: localhost:8080
  if (config.apiUrl) {
    return config.apiUrl;
  }

  // Must run before the localhost:3000 branch: otherwise /api hits Vite and returns index.html (JSON parse errors).
  // @ts-expect-error - import.meta.env is available in Vite but not in CommonJS tsconfig
  const viteApiUri = import.meta.env?.VITE_API_URI as string | undefined;
  if (typeof viteApiUri === 'string' && viteApiUri.trim() !== '') {
    return viteApiUri.replace(/\/+$/, '');
  }

  if (typeof location !== 'undefined') {
    const currentHost = location.hostname;
    if (currentHost === 'localhost' && location.port === '3000') {
      console.log(
        'Development mode: using Vite origin; ensure server.proxy forwards /api to git-proxy (see vite.config)',
      );
      return location.origin;
    }
  }

  if (typeof location !== 'undefined') {
    return location.origin;
  }

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
