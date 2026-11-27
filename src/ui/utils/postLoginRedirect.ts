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

const SSO_REDIRECT_KEY = 'git.proxy.ssoLoginRedirect';
const SSO_REDIRECT_TTL = 10 * 60 * 1000;

function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    if (character < ' ' || character === '\x7f' || character === '\\') return true;
  }
  return false;
}

function validateRedirect(destination: unknown): string | null {
  if (
    typeof destination !== 'string' ||
    destination.trim() !== destination ||
    hasUnsafeCharacters(destination)
  ) {
    return null;
  }

  const [pathname] = destination.split(/[?#]/, 1);
  if (pathname !== '/dashboard' && !pathname.startsWith('/dashboard/')) return null;
  if (pathname.includes('//')) return null;

  try {
    for (const segment of pathname.split('/')) {
      const decoded = decodeURIComponent(segment);
      if (
        decoded === '.' ||
        decoded === '..' ||
        decoded.includes('/') ||
        hasUnsafeCharacters(decoded) ||
        /%[\da-f]{2}/i.test(decoded)
      ) {
        return null;
      }
    }
  } catch {
    return null;
  }

  return destination;
}

export function loginPathWithRedirect(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  const destination = validateRedirect(`${location.pathname}${location.search}${location.hash}`);
  return destination === null
    ? '/login'
    : `/login?${new URLSearchParams({ redirect: destination })}`;
}

export function getPostLoginRedirect(search: string): string | null {
  const destinations = new URLSearchParams(search).getAll('redirect');
  return destinations.length === 1 ? validateRedirect(destinations[0]) : null;
}

export function setSsoLoginRedirect(destination: string | null): void {
  const redirect = validateRedirect(destination);
  try {
    const storage = window.sessionStorage;
    if (redirect === null) {
      storage.removeItem(SSO_REDIRECT_KEY);
    } else {
      storage.setItem(
        SSO_REDIRECT_KEY,
        JSON.stringify({ destination: redirect, savedAt: Date.now() }),
      );
    }
  } catch {
    return;
  }
}

export function consumeSsoLoginRedirect(): string | null {
  try {
    const storage = window.sessionStorage;
    const stored = storage.getItem(SSO_REDIRECT_KEY);
    if (stored === null) return null;
    storage.removeItem(SSO_REDIRECT_KEY);

    const { destination, savedAt } = JSON.parse(stored);
    if (typeof savedAt !== 'number') return null;
    const age = Date.now() - savedAt;
    return age >= 0 && age < SSO_REDIRECT_TTL ? validateRedirect(destination) : null;
  } catch {
    return null;
  }
}
