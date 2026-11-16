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
import { exec as checkHidden } from '../src/proxy/processors/push-action/checkHiddenCommits';
import { Action } from '../src/proxy/actions';
import { EMPTY_COMMIT_HASH } from '../src/proxy/constants';
import { Request } from 'express';

// must hoist these before mocking the modules
const mockSpawnSync = vi.hoisted(() => vi.fn());
const mockReaddirSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawnSync: mockSpawnSync,
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readdirSync: mockReaddirSync,
  };
});

describe('checkHiddenCommits.exec', () => {
  let action: Action;
  let req: Request;

  beforeEach(() => {
    // reset all mocks before each test
    vi.clearAllMocks();

    // prepare a fresh Action
    action = new Action('some-id', 'push', 'POST', Date.now(), 'repo.git');
    action.proxyGitPath = '/fake';
    action.commitFrom = EMPTY_COMMIT_HASH;
    action.commitTo = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    action.newIdxFiles = ['pack-test.idx'];
    req = { body: '' } as Request;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports all commits unreferenced and sets error=true', async () => {
    const COMMIT_1 = 'deadbeef';
    const COMMIT_2 = 'cafebabe';

    // 1) rev-list → no introduced commits
    // 2) verify-pack → two commits in pack
    mockSpawnSync.mockReturnValueOnce({ stdout: '' }).mockReturnValueOnce({
      stdout: `${COMMIT_1} commit 100 1\n${COMMIT_2} commit 100 2\n`,
    });

    mockReaddirSync.mockReturnValue(['pack-test.idx']);

    await checkHidden(req, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    expect(step?.logs).toContain(`checkHiddenCommits - Referenced commits: 0`);
    expect(step?.logs).toContain(`checkHiddenCommits - Unreferenced commits: 2`);
    expect(step?.logs).toContain(
      `checkHiddenCommits - Unreferenced commits in pack (2): ${COMMIT_1}, ${COMMIT_2}.\n` +
        `This usually happens when a branch was made from a commit that hasn't been approved and pushed to the remote.\n` +
        `Please rebase the branch and push again.`,
    );
    expect(action.error).toBe(true);
  });

  it('mixes referenced & unreferenced correctly', async () => {
    const COMMIT_1 = 'deadbeef';
    const COMMIT_2 = 'cafebabe';

    // 1) git rev-list → introduces one commit "deadbeef"
    // 2) git verify-pack → the pack contains two commits
    mockSpawnSync.mockReturnValueOnce({ stdout: `${COMMIT_1}\n` }).mockReturnValueOnce({
      stdout: `${COMMIT_1} commit 100 1\n${COMMIT_2} commit 100 2\n`,
    });

    mockReaddirSync.mockReturnValue(['pack-test.idx']);

    await checkHidden(req, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    expect(step?.logs).toContain('checkHiddenCommits - Referenced commits: 1');
    expect(step?.logs).toContain('checkHiddenCommits - Unreferenced commits: 1');
    expect(step?.logs).toContain(
      `checkHiddenCommits - Unreferenced commits in pack (1): ${COMMIT_2}.\n` +
        `This usually happens when a branch was made from a commit that hasn't been approved and pushed to the remote.\n` +
        `Please rebase the branch and push again.`,
    );
    expect(action.error).toBe(true);
  });

  it('reports all commits referenced and sets error=false', async () => {
    // 1) rev-list → introduces both commits
    // 2) verify-pack → the pack contains the same two commits
    mockSpawnSync.mockReturnValueOnce({ stdout: 'deadbeef\ncafebabe\n' }).mockReturnValueOnce({
      stdout: 'deadbeef commit 100 1\ncafebabe commit 100 2\n',
    });

    mockReaddirSync.mockReturnValue(['pack-test.idx']);

    await checkHidden(req, action);
    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');

    expect(step?.logs).toContain('checkHiddenCommits - Total introduced commits: 2');
    expect(step?.logs).toContain('checkHiddenCommits - Total commits in the pack: 2');
    expect(step?.logs).toContain(
      'checkHiddenCommits - All pack commits are referenced in the introduced range.',
    );
    expect(action.error).toBe(false);
  });

  it('throws if commitFrom or commitTo is missing', async () => {
    delete action.commitFrom;

    await expect(checkHidden(req, action)).rejects.toThrow(
      /Both action.commitFrom and action.commitTo must be defined/,
    );
  });
});

describe('checkHiddenCommits.exec - parent (commitFrom) exemption', () => {
  let action: Action;
  let req: Request;

  // 40-char hex object IDs so values look like real SHAs
  const PARENT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // already on remote (commitFrom)
  const NEW_1 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const NEW_2 = 'cccccccccccccccccccccccccccccccccccccccc';
  const HIDDEN = 'dddddddddddddddddddddddddddddddddddddddd'; // not reachable from commitTo

  beforeEach(() => {
    vi.clearAllMocks();

    action = new Action('some-id', 'push', 'POST', Date.now(), 'repo.git');
    action.proxyGitPath = '/fake';
    action.commitFrom = PARENT;
    action.commitTo = NEW_1;
    action.newIdxFiles = ['pack-test.idx'];
    req = { body: '' } as Request;

    mockReaddirSync.mockReturnValue(['pack-test.idx']);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not flag the parent when it appears in the pushed pack (push onto existing history)', async () => {
    // rev-list PARENT..NEW_1 → only the new commit (parent excluded by the range)
    // verify-pack → pack carries the new commit AND the already-on-remote parent
    mockSpawnSync
      .mockReturnValueOnce({ stdout: `${NEW_1}\n` })
      .mockReturnValueOnce({ stdout: `${NEW_1} commit 100 1\n${PARENT} commit 100 2\n` });

    await checkHidden(req, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    // parent is exempted → introduced set is {NEW_1, PARENT}
    expect(step?.logs).toContain('checkHiddenCommits - Total introduced commits: 2');
    expect(step?.logs).toContain('checkHiddenCommits - Total commits in the pack: 2');
    expect(step?.logs).toContain(
      'checkHiddenCommits - All pack commits are referenced in the introduced range.',
    );
    expect(action.error).toBe(false);
  });

  it('does not flag the parent on a multi-commit push', async () => {
    action.commitTo = NEW_2;

    // rev-list PARENT..NEW_2 → the two new commits
    // verify-pack → the two new commits plus the already-on-remote parent
    mockSpawnSync.mockReturnValueOnce({ stdout: `${NEW_2}\n${NEW_1}\n` }).mockReturnValueOnce({
      stdout: `${NEW_2} commit 100 1\n${NEW_1} commit 100 2\n${PARENT} commit 100 3\n`,
    });

    await checkHidden(req, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    // {NEW_1, NEW_2} introduced + PARENT exempted = 3
    expect(step?.logs).toContain('checkHiddenCommits - Total introduced commits: 3');
    expect(step?.logs).toContain(
      'checkHiddenCommits - All pack commits are referenced in the introduced range.',
    );
    expect(action.error).toBe(false);
  });

  it('still blocks a genuinely hidden commit that is not the parent (security)', async () => {
    // rev-list PARENT..NEW_1 → only the new commit
    // verify-pack → new commit, the (exempt) parent, and a hidden commit on an unapproved base
    mockSpawnSync.mockReturnValueOnce({ stdout: `${NEW_1}\n` }).mockReturnValueOnce({
      stdout: `${NEW_1} commit 100 1\n${PARENT} commit 100 2\n${HIDDEN} commit 100 3\n`,
    });

    await checkHidden(req, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    // only HIDDEN is unreferenced; PARENT is exempted, NEW_1 is in range
    expect(step?.logs).toContain('checkHiddenCommits - Referenced commits: 2');
    expect(step?.logs).toContain('checkHiddenCommits - Unreferenced commits: 1');
    expect(step?.logs).toContain(
      `checkHiddenCommits - Unreferenced commits in pack (1): ${HIDDEN}.\n` +
        `This usually happens when a branch was made from a commit that hasn't been approved and pushed to the remote.\n` +
        `Please rebase the branch and push again.`,
    );
    expect(action.error).toBe(true);
  });
});
