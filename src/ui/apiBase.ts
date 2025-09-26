const stripTrailingSlashes = (s: string) => s.replace(/\/+$/, '');

/**
 * The base URL for API requests.
 *
 * Uses the `VITE_API_URI` environment variable if set, otherwise defaults to the origin of the current page.
 * @return {string} The base URL to use for API requests.
 */
export const API_BASE = process.env.VITE_API_URI
  ? stripTrailingSlashes(process.env.VITE_API_URI)
  : location.origin;
