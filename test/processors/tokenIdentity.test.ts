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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HttpTokenIdentityProvider,
  ScmTokenCache,
  apiBaseUrl,
  createProviders,
  DEFAULT_SCM_PROVIDERS,
} from '../../src/proxy/processors/push-action/tokenIdentity';
import { SCMProvider, SCMProviderType } from '../../src/config/generated/config';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

const cred = (token: string, username = 'x-access-token') => ({ username, token });

describe('apiBaseUrl', () => {
  it('maps github.com to api.github.com', () => {
    expect(apiBaseUrl({ name: 'gh', type: SCMProviderType.Github, host: 'github.com' })).toBe(
      'https://api.github.com',
    );
  });

  it('maps a GHE.com data-residency tenant to its api subdomain', () => {
    expect(apiBaseUrl({ name: 'gh', type: SCMProviderType.Github, host: 'octo.ghe.com' })).toBe(
      'https://api.octo.ghe.com',
    );
  });

  it('maps GitHub Enterprise Server to /api/v3 on the same host', () => {
    expect(
      apiBaseUrl({ name: 'gh', type: SCMProviderType.Github, host: 'GitHub.Example.com' }),
    ).toBe('https://github.example.com/api/v3');
  });

  it('maps gitlab.com and self-managed GitLab to /api/v4', () => {
    expect(apiBaseUrl({ name: 'gl', type: SCMProviderType.Gitlab, host: 'gitlab.com' })).toBe(
      'https://gitlab.com/api/v4',
    );
    expect(
      apiBaseUrl({ name: 'gl', type: SCMProviderType.Gitlab, host: 'gitlab.example.com' }),
    ).toBe('https://gitlab.example.com/api/v4');
  });

  it('maps Forgejo, Gitea and Codeberg to /api/v1', () => {
    expect(apiBaseUrl({ name: 'cb', type: SCMProviderType.Forgejo, host: 'codeberg.org' })).toBe(
      'https://codeberg.org/api/v1',
    );
    expect(apiBaseUrl({ name: 'gt', type: SCMProviderType.Forgejo, host: 'gitea.com' })).toBe(
      'https://gitea.com/api/v1',
    );
    expect(
      apiBaseUrl({ name: 'fj', type: SCMProviderType.Forgejo, host: 'forge.example.com' }),
    ).toBe('https://forge.example.com/api/v1');
  });

  it('prefers an explicit apiUrl and strips a trailing slash', () => {
    expect(
      apiBaseUrl({
        name: 'gh',
        type: SCMProviderType.Github,
        host: 'git.example.com',
        apiUrl: 'https://api.internal.example.com/github/',
      }),
    ).toBe('https://api.internal.example.com/github');
  });
});

describe('HttpTokenIdentityProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches its host case-insensitively and nothing else', () => {
    const p = new HttpTokenIdentityProvider({
      name: 'github',
      type: SCMProviderType.Github,
      host: 'github.com',
    });
    expect(p.matches('github.com')).toBe(true);
    expect(p.matches('GitHub.com')).toBe(true);
    expect(p.matches('api.github.com')).toBe(false);
    expect(p.matches('github.example.com')).toBe(false);
  });

  it('asks GitHub with a token header and reads login', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ login: 'Octocat', id: 1 }));
    const p = new HttpTokenIdentityProvider({
      name: 'github',
      type: SCMProviderType.Github,
      host: 'github.com',
    });

    await expect(p.fetchScmIdentity(cred('ghp_x'))).resolves.toEqual({
      provider: 'github',
      username: 'Octocat',
    });
    expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: { Authorization: 'token ghp_x', Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('asks GitLab with a Bearer header and reads username', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ username: 'jane', id: 7, email: 'j@x' }));
    const p = new HttpTokenIdentityProvider({
      name: 'gitlab',
      type: SCMProviderType.Gitlab,
      host: 'gitlab.com',
    });

    await expect(p.fetchScmIdentity(cred('glpat-x'))).resolves.toEqual({
      provider: 'gitlab',
      username: 'jane',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://gitlab.com/api/v4/user');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer glpat-x',
    });
  });

  it('asks Forgejo-family hosts with a token header and reads login', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ login: 'sam', id: 3 }));
    const p = new HttpTokenIdentityProvider({
      name: 'codeberg',
      type: SCMProviderType.Forgejo,
      host: 'codeberg.org',
    });

    await expect(p.fetchScmIdentity(cred('tok'))).resolves.toEqual({
      provider: 'codeberg',
      username: 'sam',
    });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://codeberg.org/api/v1/user');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'token tok',
    });
  });

  it('returns null on a non-OK response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, false, 401));
    const p = new HttpTokenIdentityProvider(DEFAULT_SCM_PROVIDERS[0]);
    await expect(p.fetchScmIdentity(cred('bad'))).resolves.toBeNull();
  });

  it('returns null when the body does not name the owner', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    const p = new HttpTokenIdentityProvider(DEFAULT_SCM_PROVIDERS[0]);
    await expect(p.fetchScmIdentity(cred('tok'))).resolves.toBeNull();
  });

  it('returns null on a network error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchSpy.mockRejectedValueOnce(new Error('ECONNRESET'));
    const p = new HttpTokenIdentityProvider(DEFAULT_SCM_PROVIDERS[1]);
    await expect(p.fetchScmIdentity(cred('tok'))).resolves.toBeNull();
  });
});

describe('createProviders', () => {
  it('uses the built-in hosts when nothing is configured', () => {
    const names = createProviders([]).map((p) => `${p.name}:${p.host}`);
    expect(names).toEqual([
      'github:github.com',
      'gitlab:gitlab.com',
      'codeberg:codeberg.org',
      'gitea:gitea.com',
    ]);
  });

  it('uses only the configured providers when any are given', () => {
    const providers = createProviders([
      { name: 'ghes', type: SCMProviderType.Github, host: 'github.example.com' },
    ]);
    expect(providers).toHaveLength(1);
    expect(providers[0].apiUrl).toBe('https://github.example.com/api/v3');
    expect(providers[0].matches('github.com')).toBe(false);
  });
});

describe('getProviders', () => {
  it('rebuilds the list when the configured providers change after import', async () => {
    vi.resetModules();
    let configured: SCMProvider[] = [];
    vi.doMock('../../src/config', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../../src/config')>()),
      getScmProviders: () => configured,
    }));
    const mod = await import('../../src/proxy/processors/push-action/tokenIdentity');

    expect(mod.getProviders().map((p) => p.name)).toEqual([
      'github',
      'gitlab',
      'codeberg',
      'gitea',
    ]);

    configured = [{ name: 'forge', type: SCMProviderType.Forgejo, host: 'forge.example.com' }];
    expect(mod.getProviders().map((p) => p.name)).toEqual(['forge']);
    expect(mod.getProviderByName('forge')).not.toBeNull();
    expect(mod.getProviderByName('github')).toBeNull();
    vi.resetModules();
  });
});

describe('ScmTokenCache', () => {
  const identity = { provider: 'github', username: 'octocat' };
  const tok = cred('tok');

  it('misses on unknown token', () => {
    expect(new ScmTokenCache().lookup('github', cred('nope'))).toBeNull();
  });

  it('remembers the SCM account for a token', () => {
    const cache = new ScmTokenCache();
    cache.store('github', tok, identity);
    expect(cache.lookup('github', tok)).toEqual(identity);
  });

  it('scopes entries by the username half too', () => {
    const cache = new ScmTokenCache();
    cache.store('git-server', cred('pw', 'alice'), { provider: 'git-server', username: 'alice' });
    expect(cache.lookup('git-server', cred('pw', 'bob'))).toBeNull();
  });

  it('scopes entries by provider name', () => {
    const cache = new ScmTokenCache();
    cache.store('github', tok, identity);
    expect(cache.lookup('ghes', tok)).toBeNull();
  });

  it('expires entries after the ttl', () => {
    vi.useFakeTimers();
    try {
      const cache = new ScmTokenCache(1000);
      cache.store('github', tok, identity);
      vi.advanceTimersByTime(1001);
      expect(cache.lookup('github', tok)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('extends the ttl on each hit', () => {
    vi.useFakeTimers();
    try {
      const cache = new ScmTokenCache(1000);
      cache.store('github', tok, identity);
      vi.advanceTimersByTime(800);
      expect(cache.lookup('github', tok)).toEqual(identity);
      vi.advanceTimersByTime(800);
      expect(cache.lookup('github', tok)).toEqual(identity);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears', () => {
    const cache = new ScmTokenCache();
    cache.store('github', tok, identity);
    cache.clear();
    expect(cache.lookup('github', tok)).toBeNull();
  });
});
