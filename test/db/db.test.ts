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
