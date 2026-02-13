import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, getRepo } from '../../src/ui/services/repo';

const { axiosMock, processAuthErrorMock } = vi.hoisted(() => {
  const axiosFn = vi.fn() as any;
  axiosFn.get = vi.fn();
  axiosFn.post = vi.fn();
  axiosFn.patch = vi.fn();
  axiosFn.delete = vi.fn();

  return {
    axiosMock: axiosFn,
    processAuthErrorMock: vi.fn(() => 'Failed to authorize user: Not logged in.'),
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
  processAuthError: processAuthErrorMock,
}));

vi.mock('../../src/ui/services/apiConfig', () => ({
  getApiV1BaseUrl: vi.fn(async () => 'http://localhost:8080/api/v1'),
}));

describe('repo service error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets detailed error message when getRepo fails with non-401 status', async () => {
    axiosMock.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'User alice not authorised on this repository',
        },
      },
    });

    const setIsLoading = vi.fn();
    const setRepo = vi.fn();
    const setAuth = vi.fn();
    const setIsError = vi.fn();
    const setErrorMessage = vi.fn();

    await getRepo(setIsLoading, setRepo, setAuth, setIsError, setErrorMessage, 'repo-1');

    expect(setIsError).toHaveBeenCalledWith(true);
    expect(setErrorMessage).toHaveBeenCalledWith(
      'Error fetching repo: 403 User alice not authorised on this repository',
    );
    expect(setAuth).not.toHaveBeenCalledWith(false);
  });

  it('uses processAuthError when getRepo fails with 401 status', async () => {
    axiosMock.mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: 'Not logged in',
        },
      },
    });

    const setIsLoading = vi.fn();
    const setRepo = vi.fn();
    const setAuth = vi.fn();
    const setIsError = vi.fn();
    const setErrorMessage = vi.fn();

    await getRepo(setIsLoading, setRepo, setAuth, setIsError, setErrorMessage, 'repo-1');

    expect(setIsError).toHaveBeenCalledWith(true);
    expect(setAuth).toHaveBeenCalledWith(false);
    expect(processAuthErrorMock).toHaveBeenCalled();
    expect(setErrorMessage).toHaveBeenCalledWith('Failed to authorize user: Not logged in.');
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
