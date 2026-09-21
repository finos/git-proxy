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
});
