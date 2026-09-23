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

import { Request } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Action } from '../../src/proxy/actions';
import { CommitData } from '../../src/proxy/processors/types';
import * as checkIfWaitingAuthModule from '../../src/proxy/processors/push-action/checkIfWaitingAuth';
import { pushWasApproved } from '../../src/proxy/processors/push-action/checkIfWaitingAuth';

vi.mock('../../src/db', () => ({
  getPush: vi.fn(),
}));
import { getPush } from '../../src/db';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const SHA_D = 'd'.repeat(40);

/**
 * Build a fake commit record for use in commitData arrays.
 * @param {Partial<CommitData>} overrides fields to override on the default commit
 * @return {CommitData} the commit record
 */
const makeCommit = (overrides: Partial<CommitData> = {}): CommitData => ({
  tree: '1'.repeat(40),
  parent: '2'.repeat(40),
  author: 'Alice',
  authorEmail: 'alice@example.com',
  committer: 'Alice',
  committerEmail: 'alice@example.com',
  commitTimestamp: '1700000000',
  message: 'feat: initial commit',
  ...overrides,
});

/**
 * Build an Action for the given url, optionally applying extra properties.
 * @param {string} url the repository url
 * @param {Partial<Action>} props extra properties to assign to the action
 * @return {Action} the action
 */
const makeAction = (url: string, props: Partial<Action> = {}): Action => {
  const a = new Action('1234567890', 'push', 'POST', 1234567890, url);
  Object.assign(a, props);
  return a;
};

describe('checkIfWaitingAuth', () => {
  const getPushMock = vi.mocked(getPush);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exec', () => {
    let action: Action;
    let req: Request;

    beforeEach(() => {
      req = {} as Request;
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    });

    it('should set allowPush when action exists and is authorized', async () => {
      const authorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      authorizedAction.authorised = true;
      getPushMock.mockResolvedValue(authorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(true);
      expect(result).toEqual(authorizedAction);
    });

    it('should not set allowPush when action exists but not authorized', async () => {
      const unauthorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      unauthorizedAction.authorised = false;
      getPushMock.mockResolvedValue(unauthorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
    });

    it('should not set allowPush when action does not exist', async () => {
      getPushMock.mockResolvedValue(null);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
    });

    it('should not modify action when it has an error', async () => {
      action.error = true;
      const authorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      authorizedAction.authorised = true;
      getPushMock.mockResolvedValue(authorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
      expect(result.error).toBe(true);
    });

    it('should add step with error when getPush throws', async () => {
      const error = new Error('DB error');
      getPushMock.mockRejectedValue(error);

      await expect(checkIfWaitingAuthModule.exec(req, action)).rejects.toThrow(error);

      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].error).toBe(true);
      expect(action.steps[0].errorMessage).toContain('DB error');
    });

    describe('approval scoping', () => {
      const c1 = makeCommit({ message: 'commit 1', tree: 't1'.padEnd(40, '0') });
      const c2 = makeCommit({ message: 'commit 2', tree: 't2'.padEnd(40, '0'), parent: c1.tree });
      const c3 = makeCommit({ message: 'commit 3', tree: 't3'.padEnd(40, '0'), parent: c2.tree });

      it('should not reuse an approval granted for another repository', async () => {
        const approved = makeAction('test/other.git', {
          authorised: true,
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(false);
        expect(result).not.toBe(approved);
        expect(result.url).toBe('test/repo.git');
        expect(result.steps[0].logs.some((l) => /doesn't apply to this push/.test(l))).toBe(true);
      });

      it('should not reuse an approval granted for another ref (branch)', async () => {
        const approved = makeAction('test/repo.git', {
          authorised: true,
          branch: 'refs/heads/spike',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/release-f9fcbad',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(false);
        expect(result.branch).toBe('refs/heads/release-f9fcbad');
        expect(result.steps[0].logs.some((l) => /doesn't apply to this push/.test(l))).toBe(true);
      });

      it('should not reuse an approval when the pack carries commits that were not approved', async () => {
        const approved = makeAction('test/repo.git', {
          authorised: true,
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1, { ...c1, message: 'smuggled', tree: 'tree-2' }],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(false);
        expect(result.steps[0].logs.some((l) => /doesn't apply to this push/.test(l))).toBe(true);
      });

      it('should not reuse an approval when a commit in the pack has been altered', async () => {
        const approved = makeAction('test/repo.git', {
          authorised: true,
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1, c2],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1, { ...c2, parent: SHA_D }],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(false);
        expect(result.steps[0].logs.some((l) => /doesn't apply to this push/.test(l))).toBe(true);
      });

      it('should honour an approval when the re-push carries a subset of the approved commits (thinner pack)', async () => {
        const approved = makeAction('test/repo.git', {
          authorised: true,
          branch: 'refs/heads/main',
          commitFrom: SHA_A,
          commitTo: SHA_B,
          commitData: [c1, c2, c3],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/main',
          commitFrom: SHA_C,
          commitTo: SHA_B,
          commitData: [c2, c3],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(true);
        expect(result).toEqual(approved);
      });

      it('should not reuse an approval for a different commitTo', async () => {
        const approved = makeAction('test/repo.git', {
          authorised: true,
          branch: 'refs/heads/main',
          commitFrom: SHA_C,
          commitTo: SHA_A,
          commitData: [c1],
        });
        action = makeAction('test/repo.git', {
          branch: 'refs/heads/main',
          commitFrom: SHA_C,
          commitTo: SHA_B,
          commitData: [c1],
        });
        getPushMock.mockResolvedValue(approved);

        const result = await checkIfWaitingAuthModule.exec(req, action);

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].error).toBe(false);
        expect(result.allowPush).toBe(false);
        expect(result.steps[0].logs.some((l) => /doesn't apply to this push/.test(l))).toBe(true);
      });
    });
  });

  describe('pushWasApproved', () => {
    const c1 = makeCommit({ message: 'commit 1' });
    const base = (): Partial<Action> => ({
      branch: 'refs/heads/main',
      commitFrom: SHA_A,
      commitTo: SHA_B,
      commitData: [c1],
    });

    it('should return true for identical pushes', () => {
      const approved = makeAction('test/repo.git', base());
      const incoming = makeAction('test/repo.git', base());
      expect(pushWasApproved(approved, incoming)).toBe(true);
    });

    it('should return false when the url differs', () => {
      const approved = makeAction('test/other.git', base());
      const incoming = makeAction('test/repo.git', base());
      expect(pushWasApproved(approved, incoming)).toBe(false);
    });

    it('should return false when the branch differs', () => {
      const approved = makeAction('test/repo.git', { ...base(), branch: 'refs/heads/spike' });
      const incoming = makeAction('test/repo.git', { ...base(), branch: 'refs/heads/main' });
      expect(pushWasApproved(approved, incoming)).toBe(false);
    });

    it('should return false when incoming has commits but the approved push has none', () => {
      const approved = makeAction('test/repo.git', { ...base(), commitData: [] });
      const incoming = makeAction('test/repo.git', { ...base(), commitData: [c1] });
      expect(pushWasApproved(approved, incoming)).toBe(false);
    });

    it('should return false when incoming has commits but the approved push has undefined commitData', () => {
      const approved = makeAction('test/repo.git', { ...base(), commitData: undefined });
      const incoming = makeAction('test/repo.git', { ...base(), commitData: [c1] });
      expect(pushWasApproved(approved, incoming)).toBe(false);
    });

    it('should return true when both pushes have undefined commitData', () => {
      const approved = makeAction('test/repo.git', { ...base(), commitData: undefined });
      const incoming = makeAction('test/repo.git', { ...base(), commitData: undefined });
      expect(pushWasApproved(approved, incoming)).toBe(true);
    });

    it('should not compare commitFrom', () => {
      const approved = makeAction('test/repo.git', { ...base(), commitFrom: SHA_C });
      const incoming = makeAction('test/repo.git', { ...base(), commitFrom: SHA_D });
      expect(pushWasApproved(approved, incoming)).toBe(true);
    });
  });
});
