/**
 * Retrieve a decoded cookie value from `document.cookie` with given `name`.
 * @param {string} name - The name of the cookie to retrieve
 * @return {string | null} - The cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  if (!document.cookie) return null;
  
  const cookies = document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(name + '='));
    
  if (!cookies.length) return null;
  
  return decodeURIComponent(cookies[0].split('=')[1]);
};