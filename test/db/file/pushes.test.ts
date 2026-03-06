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
import * as pushesModule from '../../../src/db/file/pushes';

describe('File DB - Pushes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reject', () => {
    it('should reject a push with rejection metadata', async () => {
      const pushId = 'test-push-123';
      const mockPush = {
        id: pushId,
        authorised: false,
        canceled: false,
        rejected: false,
      };

      const rejection = {
        reason: 'Code does not meet quality standards',
        timestamp: new Date(),
        reviewer: {
          username: 'reviewer1',
          reviewerEmail: 'reviewer1@example.com',
        },
      };

      // Mock db.findOne to return the push
      vi.spyOn(pushesModule.db, 'findOne').mockImplementation((query: any, cb: any) => {
        cb(null, mockPush);
      });

      // Mock db.update to succeed
      vi.spyOn(pushesModule.db, 'update').mockImplementation(
        (query: any, update: any, options: any, cb: any) => {
          cb(null, 1);
        },
      );

      const result = await pushesModule.reject(pushId, rejection);

      expect(result).toEqual({ message: `reject ${pushId}` });
      expect(pushesModule.db.findOne).toHaveBeenCalled();
      expect(pushesModule.db.update).toHaveBeenCalledWith(
        { id: pushId },
        expect.objectContaining({
          id: pushId,
          authorised: false,
          canceled: false,
          rejected: true,
          rejection: rejection,
        }),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should throw an error if push is not found', async () => {
      const pushId = 'non-existent-push';

      // Mock db.findOne to return null
      vi.spyOn(pushesModule.db, 'findOne').mockImplementation((query: any, cb: any) => {
        cb(null, null);
      });

      const rejection = {
        reason: 'Test reason',
        timestamp: new Date(),
        reviewer: {
          username: 'reviewer1',
          reviewerEmail: 'reviewer1@example.com',
        },
      };

      await expect(pushesModule.reject(pushId, rejection)).rejects.toThrow(
        `push ${pushId} not found`,
      );
      expect(pushesModule.db.findOne).toHaveBeenCalledWith({ id: pushId }, expect.any(Function));
    });
  });
});
