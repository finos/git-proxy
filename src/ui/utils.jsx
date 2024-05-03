/**
 * Retrieve a decoded cookie value from `document.cookie` with given `name`.
 * @param {string} name
 * @return {string}
 */
export const getCookie = (name) => {
  if (!document.cookie) return null;

  const cookies = document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(name + '='));

  if (!cookies.length) return null;

  return decodeURIComponent(cookies[0].split('=')[1]);
};
