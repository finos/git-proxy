/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/mongo', () => ({
  getRepoByUrl: vi.fn(),
}));

vi.mock('../../src/db/file', () => ({
  getRepoByUrl: vi.fn(),
}));

vi.mock('../../src/config', () => ({
  getDatabase: vi.fn(() => ({ type: 'mongo' })),
}));

import * as db from '../../src/db';
import * as mongo from '../../src/db/mongo';

describe('db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isUserPushAllowed', () => {
    it('returns true if user is in canPush', async () => {
      vi.mocked(mongo.getRepoByUrl).mockResolvedValue({
        users: {
          canPush: ['alice'],
          canAuthorise: [],
        },
      } as any);

      const result = await db.isUserPushAllowed('myrepo', 'alice');
      expect(result).toBe(true);
    });

    it('returns true if user is in canAuthorise', async () => {
      vi.mocked(mongo.getRepoByUrl).mockResolvedValue({
        users: {
          canPush: [],
          canAuthorise: ['bob'],
        },
      } as any);

      const result = await db.isUserPushAllowed('myrepo', 'bob');
      expect(result).toBe(true);
    });

    it('returns false if user is in neither', async () => {
      vi.mocked(mongo.getRepoByUrl).mockResolvedValue({
        users: {
          canPush: [],
          canAuthorise: [],
        },
      } as any);

      const result = await db.isUserPushAllowed('myrepo', 'charlie');
      expect(result).toBe(false);
    });

    it('returns false if repo is not registered', async () => {
      vi.mocked(mongo.getRepoByUrl).mockResolvedValue(null);

      const result = await db.isUserPushAllowed('myrepo', 'charlie');
      expect(result).toBe(false);
    });
  });
});
