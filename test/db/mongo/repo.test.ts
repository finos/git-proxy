import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Repo } from '../../../src/db/types';

const mockFindOne = vi.fn();
const mockConnect = vi.fn(() => ({
  findOne: mockFindOne,
}));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
}));

describe('MongoDB', async () => {
  const { getRepo, getRepoByUrl } = await import('../../../src/db/mongo/repo');

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

      mockFindOne.mockResolvedValue(repoData);

      const result = await getRepo('Sample');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({ name: { $eq: 'sample' } });
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      mockFindOne.mockResolvedValue(repoData);

      const result = await getRepoByUrl('https://github.com/finos/git-proxy.git');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({
        url: { $eq: 'https://github.com/finos/git-proxy.git' },
      });
    });
  });
});
