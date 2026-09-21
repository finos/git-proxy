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
import { Action } from '../../src/proxy/actions';
import {
  GitHubTokenIdentityProvider,
  getProviderForHost,
  ScmTokenCache,
} from '../../src/proxy/processors/push-action/tokenIdentity';
import { Request } from 'express';

function makeAction(url: string): Action {
  return new Action('test-id', 'push', 'POST', Date.now(), url);
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  const token = 'ghp_testtoken123';
  const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
  return {
    headers: {
      authorization: `Basic ${encoded}`,
    },
    ...overrides,
  } as unknown as Request;
}

describe('GitHubTokenIdentityProvider', () => {
  const provider = new GitHubTokenIdentityProvider();
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('matches', () => {
    it('should match github.com', () => {
      expect(provider.matches('github.com')).toBe(true);
    });

    it('should not match gitlab.com', () => {
      expect(provider.matches('gitlab.com')).toBe(false);
    });

    it('should not match bitbucket.org', () => {
      expect(provider.matches('bitbucket.org')).toBe(false);
    });

    it('should not match self-hosted github enterprise', () => {
      expect(provider.matches('github.mycompany.com')).toBe(false);
    });
  });

  describe('fetchScmIdentity', () => {
    it('should return login on success', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'octocat' }),
      } as Response);

      const result = await provider.fetchScmIdentity('ghp_token123');

      expect(result).toEqual({ login: 'octocat' });
      expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'token ghp_token123',
          Accept: 'application/vnd.github+json',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should return null on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await provider.fetchScmIdentity('ghp_bad_token');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.fetchScmIdentity('ghp_token789');

      expect(result).toBeNull();
    });
  });
});

describe('getProviderForHost', () => {
  it('should return GitHubTokenIdentityProvider for github.com', () => {
    const provider = getProviderForHost('github.com');
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('github');
  });

  it('should return null for unsupported hosts', () => {
    expect(getProviderForHost('gitlab.com')).toBeNull();
    expect(getProviderForHost('bitbucket.org')).toBeNull();
    expect(getProviderForHost('my-git.internal.com')).toBeNull();
  });
});

describe('ScmTokenCache', () => {
  it('should return null on cache miss', () => {
    const cache = new ScmTokenCache();
    expect(cache.lookup('github', 'sometoken')).toBeNull();
  });

  it('should return username on cache hit', () => {
    const cache = new ScmTokenCache();
    cache.store('github', 'sometoken', 'octocat');
    expect(cache.lookup('github', 'sometoken')).toBe('octocat');
  });

  it('should return null after TTL expires', () => {
    const cache = new ScmTokenCache(100); // 100ms TTL
    cache.store('github', 'sometoken', 'octocat');
    // manually backdate the cache entry
    const key = (cache as any).key('github', 'sometoken');
    (cache as any).cache.set(key, { username: 'octocat', cachedAt: Date.now() - 200 });
    expect(cache.lookup('github', 'sometoken')).toBeNull();
  });

  it('should reset TTL on hit (sliding expiry)', () => {
    const cache = new ScmTokenCache(100); // 100ms TTL
    cache.store('github', 'sometoken', 'octocat');
    const key = (cache as any).key('github', 'sometoken');
    // backdate to 90ms ago — still valid, but would expire in 10ms without a hit
    (cache as any).cache.set(key, {
      username: 'octocat',
      provider: 'github',
      cachedAt: Date.now() - 90,
    });
    expect(cache.lookup('github', 'sometoken')).toBe('octocat'); // hit resets cachedAt
    // backdate again to 90ms — if TTL had not been reset, this would be 180ms total (expired)
    (cache as any).cache.get(key).cachedAt = Date.now() - 90;
    expect(cache.lookup('github', 'sometoken')).toBe('octocat'); // still valid because TTL was reset
  });

  it('should not share entries across providers', () => {
    const cache = new ScmTokenCache();
    cache.store('github', 'sometoken', 'octocat');
    expect(cache.lookup('gitlab', 'sometoken')).toBeNull();
  });

  it('should evict entries by username', () => {
    const cache = new ScmTokenCache();
    cache.store('github', 'token1', 'alice');
    cache.store('github', 'token2', 'alice');
    cache.store('github', 'token3', 'bob');
    cache.evictByUsername('github', 'alice');
    expect(cache.lookup('github', 'token1')).toBeNull();
    expect(cache.lookup('github', 'token2')).toBeNull();
    expect(cache.lookup('github', 'token3')).toBe('bob');
  });

  it('should not evict across providers', () => {
    const cache = new ScmTokenCache();
    cache.store('github', 'sometoken', 'alice');
    cache.evictByUsername('gitlab', 'alice');
    expect(cache.lookup('github', 'sometoken')).toBe('alice');
  });
});

describe('resolveUserFromToken', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let exec: typeof import('../../src/proxy/processors/push-action/resolveUserFromToken').exec;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../src/db', () => ({
      findUserByGitAccount: vi.fn().mockResolvedValue(null),
    }));

    fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;

    const mod = await import('../../src/proxy/processors/push-action/resolveUserFromToken');
    exec = mod.exec;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('should skip when req.user is set (session auth)', async () => {
    const req = makeRequest({ user: { username: 'session-user', email: 'a@b.com' } } as any);
    const action = makeAction('https://github.com/finos/git-proxy.git');
    action.user = 'session-user';

    const result = await exec(req, action);

    expect(result.user).toBe('session-user');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should resolve GitHub identity from token and fall back to SCM identity when no DB user', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);

    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await exec(req, action);

    expect(result.user).toBe('octocat');
    expect(result.userEmail).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Authorization: 'token ghp_testtoken123',
        Accept: 'application/vnd.github+json',
      },
      signal: expect.any(AbortSignal),
    });
  });

  it('should map SCM identity to git-proxy user when gitAccount matches', async () => {
    vi.resetModules();

    vi.doMock('../../src/db', () => ({
      findUserByGitAccount: vi.fn().mockResolvedValue({
        username: 'tcooper',
        email: 'thomas.cooper@example.com',
        gitAccount: 'octocat',
      }),
    }));

    const mod = await import('../../src/proxy/processors/push-action/resolveUserFromToken');

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);

    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await mod.exec(req, action);

    expect(result.user).toBe('tcooper');
    expect(result.userEmail).toBe('thomas.cooper@example.com');
  });

  it('should leave userEmail from parsePush untouched when no gitAccount match', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);

    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');
    action.userEmail = 'committer@example.com';

    const result = await exec(req, action);

    expect(result.user).toBe('octocat');
    expect(result.userEmail).toBe('committer@example.com');
  });

  it('should not call fetch for non-GitHub hosts', async () => {
    const req = makeRequest();
    const action = makeAction('https://gitlab.com/finos/git-proxy.git');

    const result = await exec(req, action);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.user).toBeUndefined();
  });

  it('should handle GitHub API errors gracefully without blocking', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');
    action.user = 'committer-fallback';

    const result = await exec(req, action);

    expect(result.user).toBe('committer-fallback');
    expect(result.error).toBe(false);
  });

  it('should handle network errors gracefully without blocking', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await exec(req, action);

    expect(result.error).toBe(false);
  });

  it('should skip when no Authorization header is present', async () => {
    const req = { headers: {} } as unknown as Request;
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await exec(req, action);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.user).toBeUndefined();
  });

  it('should skip when Authorization header is not Basic', async () => {
    const req = {
      headers: { authorization: 'Bearer some-jwt' },
    } as unknown as Request;
    const action = makeAction('https://github.com/finos/git-proxy.git');

    await exec(req, action);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should skip when Basic auth credentials have no colon separator', async () => {
    const encoded = Buffer.from('no-colon-here').toString('base64');
    const req = {
      headers: { authorization: `Basic ${encoded}` },
    } as unknown as Request;
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await exec(req, action);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.error).toBe(false);
  });

  it('should skip when action URL is unparseable', async () => {
    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');
    action.url = 'not-a-valid-url';

    const result = await exec(req, action);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.error).toBe(false);
  });
});

describe('resolveUserFromToken cache integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('should return cached identity without calling the API', async () => {
    vi.doMock('../../src/db', () => ({
      findUserByGitAccount: vi.fn(),
    }));
    vi.doMock('../../src/proxy/processors/push-action/tokenIdentity', async () => {
      const real = await vi.importActual<
        typeof import('../../src/proxy/processors/push-action/tokenIdentity')
      >('../../src/proxy/processors/push-action/tokenIdentity');
      const cache = new real.ScmTokenCache();
      cache.store('github', 'ghp_testtoken123', 'cached-user');
      return { ...real, scmTokenCache: cache };
    });
    const mod = await import('../../src/proxy/processors/push-action/resolveUserFromToken');
    const req = makeRequest();
    const action = makeAction('https://github.com/finos/git-proxy.git');

    const result = await mod.exec(req, action);

    expect(result.user).toBe('cached-user');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
