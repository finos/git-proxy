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

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Request } from 'express';
import { Action, PullType, RequestType } from '../../src/proxy/actions';
import { PullData } from '../../src/types/models';

const { existsSync, mkdir, rmSync, gitRaw } = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdir: vi.fn(),
  rmSync: vi.fn(),
  gitRaw: vi.fn(),
}));

vi.mock('fs', () => {
  const mockFs = {
    existsSync,
    rmSync,
    promises: { mkdir },
  };
  return { ...mockFs, default: mockFs };
});

vi.mock('simple-git', () => ({
  default: () => ({ raw: gitRaw }),
}));

import {
  exec as fetchWanted,
  rememberRecentFetch,
  clearRecentFetches,
} from '../../src/proxy/processors/pull-action/fetchWanted';

const WANT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const fetchPull = (overrides: Partial<PullData> = {}): PullData => ({
  protocolVersion: 2,
  command: PullType.FETCH,
  capabilities: [],
  wants: [WANT],
  haves: [],
  wantRefs: [],
  refPrefixes: [],
  shallow: [],
  done: true,
  options: [],
  ...overrides,
});

const makeAction = (): Action => {
  const action = new Action(
    'action-1',
    RequestType.PULL,
    'POST',
    Date.now(),
    'https://github.com/example/repo.git',
  );
  action.pullData = fetchPull();
  return action;
};

const req = { headers: {} } as Request;

describe('fetchWanted processor', () => {
  beforeEach(() => {
    clearRecentFetches();
    vi.clearAllMocks();
    existsSync.mockReturnValue(false);
    mkdir.mockResolvedValue(undefined);
    gitRaw.mockResolvedValue('');
  });

  afterEach(() => {
    clearRecentFetches();
  });

  it('checks out wanted commits and does not remember the want-set itself', async () => {
    const action = await fetchWanted(req, makeAction());

    expect(action.error).toBe(false);
    expect(action.commitTo).toBe(WANT);
    expect(action.pullData?.fetchedWants).toEqual([WANT]);
    expect(action.pullData?.repeatedRound).toBeUndefined();
    expect(gitRaw).toHaveBeenCalled();

    // A retry of a blocked pull must still check out so scanners can run again.
    gitRaw.mockClear();
    const retry = await fetchWanted(req, makeAction());

    expect(retry.pullData?.repeatedRound).toBeUndefined();
    expect(retry.commitTo).toBe(WANT);
    expect(gitRaw).toHaveBeenCalled();
  });

  it('skips checkout on a later negotiation round only after the chain approved the wants', async () => {
    const first = await fetchWanted(req, makeAction());
    rememberRecentFetch(first);

    gitRaw.mockClear();
    const second = await fetchWanted(req, makeAction());

    expect(second.pullData?.repeatedRound).toBe(true);
    expect(second.commitTo).toBeUndefined();
    expect(second.proxyGitPath).toBeUndefined();
    expect(gitRaw).not.toHaveBeenCalled();
  });

  it('does not skip checkout when rememberRecentFetch is omitted (blocked pull)', async () => {
    await fetchWanted(req, makeAction());
    // Simulate a scanner rejecting the pull: chain must not call rememberRecentFetch.

    gitRaw.mockClear();
    const retry = await fetchWanted(req, makeAction());

    expect(retry.pullData?.repeatedRound).toBeUndefined();
    expect(retry.commitTo).toBe(WANT);
    expect(gitRaw).toHaveBeenCalled();
  });

  it('ignores rememberRecentFetch when no checkout actually happened', async () => {
    rememberRecentFetch(makeAction());

    const action = await fetchWanted(req, makeAction());

    expect(action.pullData?.repeatedRound).toBeUndefined();
    expect(gitRaw).toHaveBeenCalled();
  });

  it('skips checkout for ls-refs requests', async () => {
    const action = makeAction();
    action.pullData = fetchPull({ command: PullType.LS_REFS, wants: [] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(result.proxyGitPath).toBeUndefined();
    expect(gitRaw).not.toHaveBeenCalled();
    expect(result.steps[0].logs.join('\n')).toContain('Not a fetch request');
  });

  it('skips checkout when the client has no wants', async () => {
    const action = makeAction();
    action.pullData = fetchPull({ wants: [] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(result.proxyGitPath).toBeUndefined();
    expect(gitRaw).not.toHaveBeenCalled();
    expect(result.steps[0].logs.join('\n')).toContain('client up to date');
  });

  it('rejects invalid object ids in wants', async () => {
    const action = makeAction();
    action.pullData = fetchPull({ wants: ['not-an-oid'] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Unable to fetch requested commits');
    expect(result.errorMessage).toContain('Invalid object id(s) in wants');
    expect(gitRaw).not.toHaveBeenCalled();
  });

  it('rejects invalid object ids in haves', async () => {
    const action = makeAction();
    action.pullData = fetchPull({ haves: ['bad-have'] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Invalid object id(s) in haves');
    expect(gitRaw).not.toHaveBeenCalled();
  });

  it('skips checkout for SSH pulls', async () => {
    const action = makeAction();
    action.protocol = 'ssh';

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(result.proxyGitPath).toBeUndefined();
    expect(gitRaw).not.toHaveBeenCalled();
    expect(result.steps[0].logs.join('\n')).toContain('SSH fetch inspection is not supported');
  });

  it('errors on unsupported repository URLs', async () => {
    const action = new Action(
      'action-1',
      RequestType.PULL,
      'POST',
      Date.now(),
      'git://github.com/example/repo.git',
    );
    action.pullData = fetchPull();

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Unsupported repository URL');
    expect(gitRaw).not.toHaveBeenCalled();
  });

  it('accepts file:// repository URLs', async () => {
    const action = new Action(
      'action-1',
      RequestType.PULL,
      'POST',
      Date.now(),
      'file:///tmp/example.git',
    );
    action.pullData = fetchPull();

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(gitRaw).toHaveBeenCalled();
    expect(result.pullData?.fetchedWants).toEqual([WANT]);
  });

  it('errors when the checkout folder already exists', async () => {
    existsSync.mockReturnValue(true);
    const action = makeAction();

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('checkout folder already exists');
    expect(result.proxyGitPath).toBeUndefined();
    expect(rmSync).toHaveBeenCalled();
  });

  it('cleans up the checkout after a git failure', async () => {
    existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
    gitRaw.mockRejectedValue(new Error('fetch failed'));
    const action = makeAction();

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Unable to fetch requested commits');
    expect(result.errorMessage).toContain('fetch failed');
    expect(rmSync).toHaveBeenCalled();
    expect(result.proxyGitPath).toBeUndefined();
    expect(result.steps[0].logs.join('\n')).toContain('.remote checkout removed after failure');
  });

  it('uses the first successfully fetched have as the base commit', async () => {
    const have = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    gitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === 'fetch' && args.includes(have)) return '';
      if (args[0] === 'fetch' && args.includes(WANT)) return '';
      return '';
    });
    const action = makeAction();
    action.pullData = fetchPull({ haves: [have] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(result.pullData?.base).toBe(have);
    expect(result.commitFrom).toBe(have);
    expect(result.commitTo).toBe(WANT);
    expect(result.steps[0].logs.join('\n')).toContain(`Fetched base commit ${have}`);
  });

  it('falls back to the empty tree when none of the haves can be fetched', async () => {
    const have = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    gitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === 'fetch' && args.includes(have)) {
        throw new Error('not found');
      }
      return '';
    });
    const action = makeAction();
    action.pullData = fetchPull({ haves: [have] });

    const result = await fetchWanted(req, action);

    expect(result.error).toBe(false);
    expect(result.pullData?.base).toBe('0000000000000000000000000000000000000000');
    expect(result.commitFrom).toBe('0000000000000000000000000000000000000000');
    expect(result.steps[0].logs.join('\n')).toContain('None of the haves exist upstream');
  });

  it('forwards the Authorization header into the throwaway repo', async () => {
    const authedReq = { headers: { authorization: 'Bearer token' } } as Request;

    await fetchWanted(authedReq, makeAction());

    expect(gitRaw).toHaveBeenCalledWith([
      'config',
      'http.extraHeader',
      'Authorization: Bearer token',
    ]);
  });

  it('deduplicates wants before checkout', async () => {
    const action = makeAction();
    action.pullData = fetchPull({ wants: [WANT, WANT] });

    const result = await fetchWanted(req, action);

    expect(result.pullData?.fetchedWants).toEqual([WANT]);
    const fetchCall = gitRaw.mock.calls.find((call) => call[0][0] === 'fetch');
    expect(fetchCall?.[0].filter((arg: string) => arg === WANT)).toEqual([WANT]);
  });

  it('sets displayName to fetchWanted.exec', () => {
    expect(fetchWanted.displayName).toBe('fetchWanted.exec');
  });
});
