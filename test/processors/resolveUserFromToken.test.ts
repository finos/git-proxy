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
import { Request } from 'express';

function makeAction(url: string): Action {
  return new Action('test-id', 'push', 'POST', Date.now(), url);
}

function basic(token: string, user = 'x-access-token'): string {
  return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: { authorization: basic('ghp_testtoken123') },
    ...overrides,
  } as unknown as Request;
}

const lastStep = (action: Action) => action.steps[action.steps.length - 1];

describe('resolveUserFromToken', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let exec: typeof import('../../src/proxy/processors/push-action/resolveUserFromToken').exec;
  let findUserByScmIdentity: ReturnType<typeof vi.fn>;
  let cache: typeof import('../../src/proxy/processors/push-action/tokenIdentity').scmTokenCache;

  const octocat = {
    username: 'tom',
    email: 'tom@example.com',
    scmIdentities: { github: 'octocat' },
  };

  beforeEach(async () => {
    vi.resetModules();

    findUserByScmIdentity = vi.fn().mockResolvedValue(null);
    vi.doMock('../../src/db', () => ({ findUserByScmIdentity }));
    vi.doMock('../../src/config', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../../src/config')>()),
      getScmProviders: () => [],
    }));

    fetchSpy = vi.spyOn(globalThis, 'fetch') as ReturnType<typeof vi.spyOn>;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    exec = (await import('../../src/proxy/processors/push-action/resolveUserFromToken')).exec;
    cache = (await import('../../src/proxy/processors/push-action/tokenIdentity')).scmTokenCache;
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('leaves a session-authenticated request alone', async () => {
    const req = makeRequest({ user: { username: 'session-user', email: 'a@b.com' } } as any);
    const action = makeAction('https://github.com/finos/git-proxy.git');
    action.user = 'session-user';

    const result = await exec(req, action);

    expect(result.user).toBe('session-user');
    expect(lastStep(result).error).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps the token owner to the linked git-proxy user', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);
    findUserByScmIdentity.mockResolvedValueOnce(octocat);

    const result = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    expect(findUserByScmIdentity).toHaveBeenCalledWith('github', 'octocat');
    expect(result.user).toBe('tom');
    expect(result.userEmail).toBe('tom@example.com');
    expect(result.pusherVerified).toBe(true);
    expect(lastStep(result).error).toBe(false);
  });

  it('never trusts the Basic-auth username half', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);
    findUserByScmIdentity.mockResolvedValueOnce(octocat);
    const req = makeRequest({ headers: { authorization: basic('ghp_x', 'alice') } } as any);

    const result = await exec(req, makeAction('https://github.com/finos/git-proxy.git'));

    expect(result.user).toBe('tom');
  });

  it('blocks when the SCM account is not linked to any user', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'stranger' }),
    } as Response);

    const result = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    expect(result.user).toBeFalsy();
    expect(result.userEmail).toBeFalsy();
    expect(result.pusherVerified).toBeFalsy();
    expect(lastStep(result).error).toBe(true);
    expect(lastStep(result).errorMessage).toContain("'stranger' is not linked");
  });

  it('blocks when the provider rejects the token', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 } as Response);

    const result = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    expect(result.user).toBeFalsy();
    expect(lastStep(result).error).toBe(true);
    expect(lastStep(result).errorMessage).toContain('did not accept the credential');
    expect(findUserByScmIdentity).not.toHaveBeenCalled();
  });

  it('blocks when the provider is unreachable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    expect(lastStep(result).error).toBe(true);
  });

  it('blocks a push to a host with no configured provider', async () => {
    const result = await exec(makeRequest(), makeAction('https://git.example.com/a/b.git'));

    expect(lastStep(result).error).toBe(true);
    expect(lastStep(result).errorMessage).toContain(
      "no SCM provider is configured for host 'git.example.com'",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['no Authorization header', {}, 'no credentials were presented'],
    ['a Bearer header', { authorization: 'Bearer abc' }, 'only HTTP Basic'],
    [
      'Basic without a separator',
      { authorization: `Basic ${Buffer.from('nocolon').toString('base64')}` },
      'malformed',
    ],
    ['Basic with an empty token', { authorization: basic('') }, 'has no token'],
  ])('blocks a request with %s', async (_label, headers, message) => {
    const req = { headers } as unknown as Request;
    const result = await exec(req, makeAction('https://github.com/finos/git-proxy.git'));

    expect(lastStep(result).error).toBe(true);
    expect(lastStep(result).errorMessage).toContain(message);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks when the repository URL cannot be parsed', async () => {
    const result = await exec(makeRequest(), makeAction('not a url'));
    expect(lastStep(result).error).toBe(true);
  });

  it('uses the cached SCM account and still re-checks the link', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);
    findUserByScmIdentity.mockResolvedValueOnce(octocat);
    await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // unlinked in the meantime: the cache does not keep the push alive
    findUserByScmIdentity.mockResolvedValueOnce(null);
    const blocked = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastStep(blocked).error).toBe(true);

    // relinked to someone else: picked up without another provider call
    findUserByScmIdentity.mockResolvedValueOnce({ ...octocat, username: 'tom2' });
    const relinked = await exec(
      makeRequest(),
      makeAction('https://github.com/finos/git-proxy.git'),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(relinked.user).toBe('tom2');
  });

  it('does not cache a rejected token', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'octocat' }),
    } as Response);
    findUserByScmIdentity.mockResolvedValueOnce(octocat);
    const result = await exec(makeRequest(), makeAction('https://github.com/finos/git-proxy.git'));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.user).toBe('tom');
  });

  it('resolves GitLab and Forgejo hosts through their own APIs', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: 'jane' }),
    } as Response);
    findUserByScmIdentity.mockResolvedValueOnce({ ...octocat, username: 'jane-gp' });
    const gl = await exec(makeRequest(), makeAction('https://gitlab.com/group/repo.git'));
    expect(fetchSpy.mock.calls[0][0]).toBe('https://gitlab.com/api/v4/user');
    expect(findUserByScmIdentity).toHaveBeenCalledWith('gitlab', 'jane');
    expect(gl.user).toBe('jane-gp');

    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'sam' }) } as Response);
    findUserByScmIdentity.mockResolvedValueOnce({ ...octocat, username: 'sam-gp' });
    const cb = await exec(makeRequest(), makeAction('https://codeberg.org/org/repo.git'));
    expect(fetchSpy.mock.calls[1][0]).toBe('https://codeberg.org/api/v1/user');
    expect(findUserByScmIdentity).toHaveBeenCalledWith('codeberg', 'sam');
    expect(cb.user).toBe('sam-gp');
  });
});
