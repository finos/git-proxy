import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addUser,
  deleteUser,
  getRepo,
  getRepos,
  addRepo,
  deleteRepo,
} from '../../src/ui/services/repo';

const { axiosMock } = vi.hoisted(() => {
  const axiosFn = vi.fn() as any;
  axiosFn.get = vi.fn();
  axiosFn.post = vi.fn();
  axiosFn.patch = vi.fn();
  axiosFn.delete = vi.fn();

  return {
    axiosMock: axiosFn,
  };
});

vi.mock('axios', () => ({
  default: axiosMock,
}));

vi.mock('../../src/ui/services/auth.js', () => ({
  getAxiosConfig: vi.fn(() => ({
    withCredentials: true,
    headers: {},
  })),
  processAuthError: vi.fn(),
}));

vi.mock('../../src/ui/services/apiConfig', () => ({
  getApiV1BaseUrl: vi.fn(async () => 'http://localhost:8080/api/v1'),
}));

describe('repo service error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on successful getRepo', async () => {
    const repoData = {
      name: 'test-repo',
      project: 'org',
      url: 'https://example.com/org/test-repo.git',
    };
    axiosMock.mockResolvedValue({ data: repoData });

    const result = await getRepo('repo-1');

    expect(result).toEqual({ success: true, data: repoData });
  });

  it('returns error result when getRepo fails with non-401 status', async () => {
    axiosMock.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'User alice not authorised on this repository',
        },
      },
    });

    const result = await getRepo('repo-1');

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'User alice not authorised on this repository',
    });
  });

  it('returns error result when getRepo fails with 401 status', async () => {
    axiosMock.mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: 'Not logged in',
        },
      },
    });

    const result = await getRepo('repo-1');

    expect(result).toEqual({
      success: false,
      status: 401,
      message: 'Not logged in',
    });
  });

  it('returns fallback message when response payload is missing', async () => {
    axiosMock.mockRejectedValue(new Error('network timeout'));

    const result = await getRepo('repo-1');

    expect(result).toEqual({
      success: false,
      status: undefined,
      message: 'network timeout',
    });
  });

  it('throws backend message when addUser patch request fails', async () => {
    axiosMock.get.mockResolvedValue({
      data: {
        users: {
          canAuthorise: [],
          canPush: [],
        },
      },
    });

    axiosMock.patch.mockRejectedValue({
      response: {
        status: 404,
        data: {
          message: 'User bob not found',
        },
      },
    });

    await expect(addUser('repo-1', 'bob', 'authorise')).rejects.toThrow('User bob not found');
  });
});

describe('repo service additional functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRepos', () => {
    it('returns sorted repos on success', async () => {
      const reposData = [
        { name: 'zebra-repo', project: 'org', url: 'https://example.com/org/zebra-repo.git' },
        { name: 'alpha-repo', project: 'org', url: 'https://example.com/org/alpha-repo.git' },
      ];

      axiosMock.mockResolvedValue({ data: reposData });

      const result = await getRepos();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: 'alpha-repo', project: 'org', url: 'https://example.com/org/alpha-repo.git' },
        { name: 'zebra-repo', project: 'org', url: 'https://example.com/org/zebra-repo.git' },
      ]);
    });

    it('passes query parameters correctly', async () => {
      axiosMock.mockResolvedValue({ data: [] });

      await getRepos({ active: true });

      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/repo?active=true',
        expect.any(Object),
      );
    });

    it('returns error result when getRepos fails', async () => {
      axiosMock.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Database connection failed',
          },
        },
      });

      const result = await getRepos();

      expect(result).toEqual({
        success: false,
        status: 500,
        message: 'Database connection failed',
      });
    });

    it('uses fallback message when error has no response data', async () => {
      axiosMock.mockRejectedValue(new Error('Connection timeout'));

      const result = await getRepos();

      expect(result).toEqual({
        success: false,
        status: undefined,
        message: 'Connection timeout',
      });
    });
  });

  describe('addRepo', () => {
    it('returns created repo on success', async () => {
      const newRepo = {
        name: 'new-repo',
        project: 'org',
        url: 'https://example.com/org/new-repo.git',
      };

      axiosMock.post.mockResolvedValue({ data: { ...newRepo, id: 'repo-123' } });

      const result = await addRepo(newRepo as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...newRepo, id: 'repo-123' });
      expect(axiosMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/repo',
        newRepo,
        expect.any(Object),
      );
    });

    it('returns error result when addRepo fails', async () => {
      const newRepo = {
        name: 'duplicate-repo',
        project: 'org',
        url: 'https://example.com/org/duplicate-repo.git',
      };

      axiosMock.post.mockRejectedValue({
        response: {
          status: 409,
          data: {
            message: 'Repository already exists',
          },
        },
      });

      const result = await addRepo(newRepo as any);

      expect(result).toEqual({
        success: false,
        status: 409,
        message: 'Repository already exists',
      });
    });
  });

  describe('addUser', () => {
    it('successfully adds user when not duplicate', async () => {
      axiosMock.get.mockResolvedValue({
        data: {
          users: {
            canAuthorise: ['alice'],
            canPush: ['bob'],
          },
        },
      });

      axiosMock.patch.mockResolvedValue({ data: {} });

      await expect(addUser('repo-1', 'charlie', 'authorise')).resolves.toBeUndefined();

      expect(axiosMock.patch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/repo/repo-1/user/authorise',
        { username: 'charlie' },
        expect.any(Object),
      );
    });

    it('throws DupUserValidationError when user already has the role', async () => {
      axiosMock.get.mockResolvedValue({
        data: {
          users: {
            canAuthorise: ['alice'],
            canPush: ['bob'],
          },
        },
      });

      await expect(addUser('repo-1', 'alice', 'authorise')).rejects.toThrow(
        'Duplicate user can not be added',
      );

      expect(axiosMock.patch).not.toHaveBeenCalled();
    });

    it('checks canPush list for push action', async () => {
      axiosMock.get.mockResolvedValue({
        data: {
          users: {
            canAuthorise: [],
            canPush: ['bob'],
          },
        },
      });

      await expect(addUser('repo-1', 'bob', 'push')).rejects.toThrow(
        'Duplicate user can not be added',
      );
    });

    it('throws error from canAddUser validation failure', async () => {
      axiosMock.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: 'Repository not found',
          },
        },
      });

      await expect(addUser('repo-1', 'charlie', 'authorise')).rejects.toThrow(
        'Repository not found',
      );
    });
  });

  describe('deleteUser', () => {
    it('successfully deletes user', async () => {
      axiosMock.delete.mockResolvedValue({ data: {} });

      await expect(deleteUser('alice', 'repo-1', 'authorise')).resolves.toBeUndefined();

      expect(axiosMock.delete).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/repo/repo-1/user/authorise/alice',
        expect.any(Object),
      );
    });

    it('throws error when deleteUser fails', async () => {
      axiosMock.delete.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: 'User not found in repository',
          },
        },
      });

      await expect(deleteUser('charlie', 'repo-1', 'authorise')).rejects.toThrow(
        'User not found in repository',
      );
    });

    it('throws fallback message when error has no response data', async () => {
      axiosMock.delete.mockRejectedValue(new Error('Network error'));

      await expect(deleteUser('alice', 'repo-1', 'push')).rejects.toThrow('Network error');
    });
  });

  describe('deleteRepo', () => {
    it('successfully deletes repository', async () => {
      axiosMock.delete.mockResolvedValue({ data: {} });

      await expect(deleteRepo('repo-1')).resolves.toBeUndefined();

      expect(axiosMock.delete).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/repo/repo-1/delete',
        expect.any(Object),
      );
    });

    it('throws error when deleteRepo fails', async () => {
      axiosMock.delete.mockRejectedValue({
        response: {
          status: 403,
          data: {
            message: 'Insufficient permissions to delete repository',
          },
        },
      });

      await expect(deleteRepo('repo-1')).rejects.toThrow(
        'Insufficient permissions to delete repository',
      );
    });

    it('throws fallback message when error has no response data', async () => {
      axiosMock.delete.mockRejectedValue(new Error('Connection refused'));

      await expect(deleteRepo('repo-1')).rejects.toThrow('Connection refused');
    });
  });
});
