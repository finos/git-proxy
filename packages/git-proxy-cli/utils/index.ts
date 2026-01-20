import axios from 'axios';
import fs from 'fs';

export const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';

export const getCliPostRequestConfig = async (baseUrl: string) => {
  const initialCookies = fs.existsSync(GIT_PROXY_COOKIE_FILE)
    ? fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8').split('; ')
    : null;

  if (process.env.NODE_ENV === 'test') {
    return {
      headers: {
        'Content-Type': 'application/json',
        Cookie: initialCookies,
      },
      withCredentials: true,
    };
  }
  const csrfTokenResponse = await axios.get(`${baseUrl}/api/auth/csrf-token`, {
    headers: {
      Cookie: initialCookies ? initialCookies.join('; ') : null,
    },
  });

  return {
    headers: {
      'Content-Type': 'application/json',
      Cookie: initialCookies ? initialCookies.join('; ') : csrfTokenResponse.headers['set-cookie'],
      'X-CSRF-TOKEN': csrfTokenResponse.data.csrfToken,
    },
    withCredentials: true,
  };
};

export const getCliCookies = () => {
  return fs.existsSync(GIT_PROXY_COOKIE_FILE)
    ? fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8').split('; ')
    : null;
};

export const ensureAuthCookie = () => {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authentication required. Please login first.');
    process.exitCode = 1;
    return false;
  }
  return true;
};
