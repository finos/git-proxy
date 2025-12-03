import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as repoModule from '../../../src/db/file/repo';
import { Repo } from '../../../src/db/types';

describe('File DB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRepo', () => {
    it('should get the repo using the name', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'http://example.com/sample-repo.git',
      };

      vi.spyOn(repoModule.db, 'findOne').mockImplementation((query: any, cb: any) =>
        cb(null, repoData),
      );

      const result = await repoModule.getRepo('Sample');
      expect(result).toEqual(repoData);
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      vi.spyOn(repoModule.db, 'findOne').mockImplementation((query: any, cb: any) =>
        cb(null, repoData),
      );

      const result = await repoModule.getRepoByUrl('https://github.com/finos/git-proxy.git');
      expect(result).toEqual(repoData);
    });

    it('should return null if the repo is not found', async () => {
      const spy = vi
        .spyOn(repoModule.db, 'findOne')
        .mockImplementation((query: any, cb: any) => cb(null, null));

      const result = await repoModule.getRepoByUrl('https://github.com/finos/missing-repo.git');

      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://github.com/finos/missing-repo.git' }),
        expect.any(Function),
      );
    });

    it('should reject if the database returns an error', async () => {
      vi.spyOn(repoModule.db, 'findOne').mockImplementation((query: any, cb: any) =>
        cb(new Error('DB error')),
      );

      await expect(
        repoModule.getRepoByUrl('https://github.com/finos/git-proxy.git'),
      ).rejects.toThrow('DB error');
    });
  });
});
