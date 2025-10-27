/**
 * DEPRECATED: This file is kept for backward compatibility.
 * New code should use apiConfig.ts instead.
 *
 * This now delegates to the runtime config system for consistency.
 */
import { getBaseUrl } from './services/apiConfig';

const stripTrailingSlashes = (s: string) => s.replace(/\/+$/, '');

/**
 * The base URL for API requests.
 *
 * Uses runtime configuration with intelligent fallback to handle:
 * - Development (localhost:3000 → localhost:8080)
 * - Docker (empty apiUrl → same origin)
 * - Production (configured apiUrl or same origin)
 *
 * Note: This is a synchronous export that will initially be empty string,
 * then gets updated. For reliable usage, import getBaseUrl() from apiConfig.ts instead.
 */
export let API_BASE = '';

// Initialize API_BASE asynchronously
getBaseUrl()
  .then((url) => {
    API_BASE = stripTrailingSlashes(url);
  })
  .catch(() => {
    API_BASE = stripTrailingSlashes(location.origin);
  });
