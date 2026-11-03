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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { Action, Step } from '../../src/proxy/actions';
import type { Mock } from 'vitest';
import { Request } from 'express';

vi.mock('../../src/db', () => ({
  findUser: vi.fn(),
  isUserPushAllowed: vi.fn(),
}));

// import after mocking
import { findUser, isUserPushAllowed } from '../../src/db';
import { exec } from '../../src/proxy/processors/push-action/checkUserPushPermission';

describe('checkUserPushPermission', () => {
  let findUserMock: Mock;
  let isUserPushAllowedMock: Mock;

  beforeEach(() => {
    findUserMock = vi.mocked(findUser);
    isUserPushAllowedMock = vi.mocked(isUserPushAllowed);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('exec', () => {
    let action: Action;
    let req: Request;
    let stepLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      req = {} as Request;
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'https://github.com/finos/git-proxy.git',
      );
      action.user = 'db-user';
      stepLogSpy = vi.spyOn(Step.prototype, 'log');
    });

    it('should allow push when user has permission', async () => {
      findUserMock.mockResolvedValue({ username: 'db-user', email: 'db-user@test.com' });
      isUserPushAllowedMock.mockResolvedValue(true);

      const result = await exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(stepLogSpy).toHaveBeenLastCalledWith(
        'User db-user is allowed to push on repo https://github.com/finos/git-proxy.git',
      );
    });

    it('should reject push when user has no permission', async () => {
      findUserMock.mockResolvedValue({ username: 'db-user', email: 'db-user@test.com' });
      isUserPushAllowedMock.mockResolvedValue(false);

      const result = await exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepLogSpy).toHaveBeenLastCalledWith(
        `Your push has been blocked (db-user is not allowed to push on repo https://github.com/finos/git-proxy.git)`,
      );
      expect(result.steps[0].errorMessage).toContain('Your push has been blocked');
    });

    it('should reject push when no user found', async () => {
      findUserMock.mockResolvedValue(null);

      const result = await exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepLogSpy).toHaveBeenLastCalledWith(
        `Your push has been blocked (db-user is not allowed to push on repo https://github.com/finos/git-proxy.git)`,
      );
      expect(result.steps[0].errorMessage).toContain('Your push has been blocked');
    });

    it('should return error when no user is set in the action', async () => {
      action.user = undefined;
      findUserMock.mockResolvedValue(null);

      const result = await exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(result.steps[0].errorMessage).toContain(
        'Push blocked: User not found. Please contact an administrator for support.',
      );
    });

    describe('fuzzing', () => {
      it('should not crash on arbitrary findUser return values (fuzzing)', async () => {
        const maybeUser = fc.sample(
          fc.oneof(
            fc.constant(null),
            fc.record({
              username: fc.string(),
              email: fc.option(fc.string()),
            }),
          ),
          1,
        )[0];
        findUserMock.mockResolvedValue(maybeUser);

        const result = await exec(req, action);

        expect(result.steps).toHaveLength(1);
        if (maybeUser) {
          expect(result.steps[0].error).toBe(true);
        } else {
          expect(result.steps[0].error).toBe(true);
        }
      });
    });
  });
});
