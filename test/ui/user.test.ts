import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUser, getUsers, updateUser } from '../../src/ui/services/user';

const { axiosMock } = vi.hoisted(() => {
  const axiosFn = vi.fn() as any;
  axiosFn.post = vi.fn();

  return {
    axiosMock: axiosFn,
  };
});

vi.mock('axios', () => ({
  default: axiosMock,
}));

vi.mock('../../src/ui/services/apiConfig', () => ({
  getBaseUrl: vi.fn(async () => 'http://localhost:8080'),
  getApiV1BaseUrl: vi.fn(async () => 'http://localhost:8080/api/v1'),
}));

vi.mock('../../src/ui/services/auth', () => ({
  getAxiosConfig: vi.fn(() => ({
    withCredentials: true,
    headers: {},
  })),
  processAuthError: vi.fn((error) => `Auth error: ${error?.response?.data?.message || 'Unknown'}`),
}));

describe('user service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUser', () => {
    it('fetches current user profile when no id is provided', async () => {
      const userData = { id: 'user-1', username: 'alice', email: 'alice@example.com' };
      const setUser = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.mockResolvedValue({ data: userData });

      await getUser(setIsLoading, setUser);

      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/profile',
        expect.any(Object),
      );
      expect(setUser).toHaveBeenCalledWith(userData);
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('fetches specific user when id is provided', async () => {
      const userData = { id: 'user-2', username: 'bob', email: 'bob@example.com' };
      const setUser = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.mockResolvedValue({ data: userData });

      await getUser(setIsLoading, setUser, undefined, undefined, 'user-2');

      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/user/user-2',
        expect.any(Object),
      );
      expect(setUser).toHaveBeenCalledWith(userData);
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles 401 auth errors', async () => {
      const setAuth = vi.fn();
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.mockRejectedValue({
        response: {
          status: 401,
          data: {
            message: 'Session expired',
          },
        },
      });

      await getUser(setIsLoading, undefined, setAuth, setErrorMessage);

      expect(setAuth).toHaveBeenCalledWith(false);
      expect(setErrorMessage).toHaveBeenCalledWith('Auth error: Session expired');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles non-401 errors with formatted message', async () => {
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: 'User not found',
          },
        },
      });

      await getUser(setIsLoading, undefined, undefined, setErrorMessage);

      expect(setErrorMessage).toHaveBeenCalledWith('Error fetching user: 404 User not found');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles errors without status code', async () => {
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.mockRejectedValue(new Error('Network timeout'));

      await getUser(setIsLoading, undefined, undefined, setErrorMessage);

      expect(setErrorMessage).toHaveBeenCalledWith('Error fetching user: Network timeout');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('works with minimal callbacks provided', async () => {
      const userData = { id: 'user-1', username: 'alice', email: 'alice@example.com' };

      axiosMock.mockResolvedValue({ data: userData });

      await expect(getUser()).resolves.toBeUndefined();
    });
  });

  describe('getUsers', () => {
    it('fetches all users successfully', async () => {
      const usersData = [
        { id: 'user-1', username: 'alice', email: 'alice@example.com' },
        { id: 'user-2', username: 'bob', email: 'bob@example.com' },
      ];
      const setUsers = vi.fn();
      const setIsLoading = vi.fn();
      const setAuth = vi.fn();
      const setErrorMessage = vi.fn();

      axiosMock.mockResolvedValue({ data: usersData });

      await getUsers(setIsLoading, setUsers, setAuth, setErrorMessage);

      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/user',
        expect.any(Object),
      );
      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setUsers).toHaveBeenCalledWith(usersData);
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles 401 errors', async () => {
      const setUsers = vi.fn();
      const setIsLoading = vi.fn();
      const setAuth = vi.fn();
      const setErrorMessage = vi.fn();

      axiosMock.mockRejectedValue({
        response: {
          status: 401,
          data: {
            message: 'Not authenticated',
          },
        },
      });

      await getUsers(setIsLoading, setUsers, setAuth, setErrorMessage);

      expect(setAuth).toHaveBeenCalledWith(false);
      expect(setErrorMessage).toHaveBeenCalledWith('Auth error: Not authenticated');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles non-401 errors', async () => {
      const setUsers = vi.fn();
      const setIsLoading = vi.fn();
      const setAuth = vi.fn();
      const setErrorMessage = vi.fn();

      axiosMock.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Database error',
          },
        },
      });

      await getUsers(setIsLoading, setUsers, setAuth, setErrorMessage);

      expect(setErrorMessage).toHaveBeenCalledWith('Error fetching users: 500 Database error');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('sets loading to false even when error occurs', async () => {
      const setUsers = vi.fn();
      const setIsLoading = vi.fn();
      const setAuth = vi.fn();
      const setErrorMessage = vi.fn();

      axiosMock.mockRejectedValue(new Error('Network error'));

      await getUsers(setIsLoading, setUsers, setAuth, setErrorMessage);

      expect(setIsLoading).toHaveBeenCalledWith(true);
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('updateUser', () => {
    it('successfully updates user', async () => {
      const userData = { id: 'user-1', username: 'alice', email: 'alice@example.com' };
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.post.mockResolvedValue({ data: {} });

      await updateUser(userData as any, setErrorMessage, setIsLoading);

      expect(axiosMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/gitAccount',
        userData,
        expect.any(Object),
      );
      expect(setErrorMessage).not.toHaveBeenCalled();
      expect(setIsLoading).not.toHaveBeenCalled();
    });

    it('handles update errors', async () => {
      const userData = { id: 'user-1', username: 'alice', email: 'alice@example.com' };
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: 'Invalid email format',
          },
        },
      });

      await updateUser(userData as any, setErrorMessage, setIsLoading);

      expect(setErrorMessage).toHaveBeenCalledWith('Error updating user: 400 Invalid email format');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('handles errors without status code', async () => {
      const userData = { id: 'user-1', username: 'alice', email: 'alice@example.com' };
      const setErrorMessage = vi.fn();
      const setIsLoading = vi.fn();

      axiosMock.post.mockRejectedValue(new Error('Connection failed'));

      await updateUser(userData as any, setErrorMessage, setIsLoading);

      expect(setErrorMessage).toHaveBeenCalledWith('Error updating user: Connection failed');
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });
  });
});
