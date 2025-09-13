const strip = (s: string) => s.replace(/\/+$/, '');
/**
 * The base URL for API requests.
 *
 * Uses the `VITE_API_URI` environment variable if set, otherwise defaults to the current origin.
 * @return {string} The base URL to use for API requests.
 */
export const API_BASE = process.env.VITE_API_URI ? strip(process.env.VITE_API_URI) : '';
