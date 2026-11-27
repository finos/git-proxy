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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeSsoLoginRedirect,
  getPostLoginRedirect,
  loginPathWithRedirect,
  setSsoLoginRedirect,
} from '../../src/ui/utils/postLoginRedirect';

describe('post-login redirect query', () => {
  it('round-trips the dashboard path, query, and hash without changing their encoding', () => {
    const location = {
      pathname: '/dashboard/repo/team%20repo',
      search: '?filter=team%2Frepo&label=a+b',
      hash: '#review%20details',
    };
    const loginPath = loginPathWithRedirect(location);

    expect(loginPath).toMatch(/^\/login\?redirect=/);
    expect(getPostLoginRedirect(loginPath.slice('/login'.length))).toBe(
      `${location.pathname}${location.search}${location.hash}`,
    );
  });

  it.each(['/dashboard', '/dashboard/'])('accepts the dashboard root %s', (destination) => {
    expect(getPostLoginRedirect(`?${new URLSearchParams({ redirect: destination })}`)).toBe(
      destination,
    );
  });

  it('returns plain login for a location outside the dashboard', () => {
    expect(loginPathWithRedirect({ pathname: '/login', search: '?source=guard', hash: '' })).toBe(
      '/login',
    );
  });

  it.each([
    '',
    '/login',
    '/api/auth/oidc/callback',
    '/dashboard-other',
    'dashboard/repo',
    'https://example.com/dashboard/repo',
    '//example.com/dashboard/repo',
    '/dashboard\\repo',
    '/dashboard/repo?label=one\ttwo',
    '/dashboard/repo#review\x7f',
    '/dashboard//repo',
    '/dashboard/repo/../push',
    '/dashboard/%2e%2e/login',
    '/dashboard/repo%2Fother',
    '/dashboard/repo%5Cother',
    '/dashboard/repo%00',
    '/dashboard/%252e%252e/login',
    '/dashboard/repo%',
  ])('rejects an unsafe destination: %j', (destination) => {
    expect(getPostLoginRedirect(`?${new URLSearchParams({ redirect: destination })}`)).toBeNull();
  });

  it('returns null for missing or repeated redirect parameters', () => {
    expect(getPostLoginRedirect('?source=guard')).toBeNull();
    expect(getPostLoginRedirect('?redirect=/dashboard/repo&redirect=/dashboard/push')).toBeNull();
  });
});

describe('SSO post-login redirect', () => {
  const destination = '/dashboard/push/42?tab=diff#file';
  const storageKey = 'git.proxy.ssoLoginRedirect';
  const ttl = 10 * 60 * 1000;
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns a fresh destination only once', () => {
    setSsoLoginRedirect(destination);
    vi.setSystemTime(Date.now() + ttl - 1);

    expect(consumeSsoLoginRedirect()).toBe(destination);
    expect(consumeSsoLoginRedirect()).toBeNull();
  });

  it('discards the destination at ten minutes', () => {
    setSsoLoginRedirect(destination);
    vi.setSystemTime(Date.now() + ttl);

    expect(consumeSsoLoginRedirect()).toBeNull();
    expect(entries.size).toBe(0);
  });

  it.each([null, '/login'])('clears any pending destination when set to %j', (replacement) => {
    setSsoLoginRedirect(destination);
    setSsoLoginRedirect(replacement);

    expect(entries.size).toBe(0);
    expect(consumeSsoLoginRedirect()).toBeNull();
  });

  it('discards malformed storage', () => {
    entries.set(storageKey, '{invalid JSON');

    expect(consumeSsoLoginRedirect()).toBeNull();
    expect(entries.size).toBe(0);
  });

  it('revalidates a destination read from storage', () => {
    entries.set(storageKey, JSON.stringify({ destination: '/login', savedAt: Date.now() }));

    expect(consumeSsoLoginRedirect()).toBeNull();
    expect(entries.size).toBe(0);
  });

  it('fails safely when access to session storage throws', () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('Session storage is unavailable');
      },
    });

    expect(() => setSsoLoginRedirect(destination)).not.toThrow();
    expect(consumeSsoLoginRedirect()).toBeNull();
  });
});
