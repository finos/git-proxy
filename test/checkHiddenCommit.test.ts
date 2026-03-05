import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { exec as checkHidden } from '../src/proxy/processors/push-action/checkHiddenCommits';
import { Action } from '../src/proxy/actions';
import { EMPTY_COMMIT_HASH } from '../src/proxy/processors/constants';
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
        `Please get approval on the commits, push them and try again.`,
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
        `Please get approval on the commits, push them and try again.`,
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
