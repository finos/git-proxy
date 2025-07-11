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

/**
 * Retrieve a string indicating whether a repository URL is hosted
 * by a known SCM provider (github or gitlab).
 * @param {string} url The repository URL.
 * @return {string} A string representing the SCM provider or 'unknown'.
 */
export const getGitProvider = (url: string) => {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === 'github.com') return 'github';
  if (hostname.includes('gitlab')) return 'gitlab';
  return 'unknown';
};

/**
 * Predicts a user's profile URL based on their username and the SCM provider's details.
 * @param {string} username The username.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string | null} The predicted profile URL or null
 */
export const getUserProfileUrl = (username: string, provider: string, hostname: string) => {
  if (provider == 'github') {
    return `https://github.com/${username}`;
  } else if (provider == 'gitlab') {
    return `https://${hostname}/${username}`;
  } else {
    return null;
  }
};

/**
 * Attempts to construct a link to the user's profile at an SCM provider.
 * @param {string} username The username.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string} A string containing an HTML A tag pointing to the user's profile, if possible, degrading to just the username or 'N/A' when not (e.g. because the SCM provider is unknown).
 */
export const getUserProfileLink = (username: string, provider: string, hostname: string) => {
  if (username) {
    let profileData = '';
    const profileUrl = getUserProfileUrl(username, provider, hostname);
    if (profileUrl) {
      profileData = `<a href="${profileUrl}" rel='noreferrer' target='_blank'>${username}</a>`;
    } else {
      profileData = `<span>${username}</span>`;
    }
    return profileData;
  } else {
    return 'N/A';
  }
};
