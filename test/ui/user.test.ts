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
      const pagedData = {
        data: [
          { id: 'user-1', username: 'alice', email: 'alice@example.com' },
          { id: 'user-2', username: 'bob', email: 'bob@example.com' },
        ],
        total: 2,
      };

      axiosMock.mockResolvedValue({ data: pagedData });

      const result = await getUsers();

      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/user',
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(pagedData);
    });

    it('handles 401 errors', async () => {
      axiosMock.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Not authenticated' },
        },
      });

      const result = await getUsers();

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
    });

    it('handles non-401 errors', async () => {
      axiosMock.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Database error' },
        },
      });

      const result = await getUsers();

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
    });

    it('sets loading to false even when error occurs', async () => {
      axiosMock.mockRejectedValue(new Error('Network error'));

      const result = await getUsers();

      expect(result.success).toBe(false);
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
