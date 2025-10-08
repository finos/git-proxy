import { describe, it, expect, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { Action } from '../../src/proxy/actions/Action';
import * as processor from '../../src/proxy/processors/push-action/checkRepoInAuthorisedList';
import * as db from '../../src/db';

describe('Check a Repo is in the authorised list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the action if the repository is whitelisted in the db', async () => {
    vi.spyOn(db, 'getRepoByUrl').mockResolvedValue({
      name: 'repo-is-ok',
      project: 'thisproject',
      url: 'https://github.com/thisproject/repo-is-ok',
      users: { canPush: [], canAuthorise: [] },
    });

    const action = new Action('123', 'type', 'get', 1234, 'thisproject/repo-is-ok');
    const result = await processor.exec(null, action);

    expect(result.error).toBe(false);
    expect(result.steps[0].logs[0]).toBe(
      'checkRepoInAuthorisedList - repo thisproject/repo-is-ok is in the authorisedList',
    );
  });

  it('rejects the action if repository not in the db', async () => {
    vi.spyOn(db, 'getRepoByUrl').mockResolvedValue(null);

    const action = new Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    const result = await processor.exec(null, action);

    expect(result.error).toBe(true);
    expect(result.steps[0].logs[0]).toBe(
      'checkRepoInAuthorisedList - repo thisproject/repo-is-not-ok is not in the authorised whitelist, ending',
    );
  });

  describe('fuzzing', () => {
    it('should not crash on random repo names', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (repoName) => {
          const action = new Action('123', 'type', 'get', 1234, repoName);
          const result = await processor.exec(null, action);
          expect(result.error).toBe(true);
        }),
        { numRuns: 1000 },
      );
    });
  });
});
