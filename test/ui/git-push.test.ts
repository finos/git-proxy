import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { authorisePush, cancelPush, rejectPush } from '../../src/ui/services/git-push';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../../src/ui/services/apiConfig', () => ({
  getApiV1BaseUrl: vi.fn(async () => 'http://localhost:8080/api/v1'),
}));

vi.mock('../../src/ui/services/auth', () => ({
  getAxiosConfig: vi.fn(() => ({
    withCredentials: true,
    headers: {},
  })),
  processAuthError: vi.fn(),
}));

describe('git-push service action errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success for authorise action', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} } as any);

    const result = await authorisePush('push-123', [{ label: 'LGTM', checked: true }]);

    expect(result).toEqual({ success: true });
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/push/push-123/authorise',
      {
        params: {
          attestation: [{ label: 'LGTM', checked: true }],
        },
      },
      expect.any(Object),
    );
  });

  it('returns backend not-logged-in message for authorise 401 errors', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: 'Not logged in',
        },
      },
    });

    const result = await authorisePush('push-123', []);

    expect(result).toEqual({
      success: false,
      status: 401,
      message: 'Not logged in',
    });
  });

  it('returns backend message for reject 403 errors', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'User alice is not authorised to reject changes on this project',
        },
      },
    });

    const result = await rejectPush('push-456');

    expect(result).toEqual({
      success: false,
      status: 403,
      message: 'User alice is not authorised to reject changes on this project',
    });
  });

  it('returns backend message for cancel 401 errors', async () => {
    vi.mocked(axios.post).mockRejectedValue({
      response: {
        status: 401,
        data: {
          message: 'Not logged in',
        },
      },
    });

    const result = await cancelPush('push-789');

    expect(result).toEqual({
      success: false,
      status: 401,
      message: 'Not logged in',
    });
  });

  it('falls back to thrown error message when response payload is missing', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('network timeout'));

    const result = await rejectPush('push-999');

    expect(result).toEqual({
      success: false,
      status: undefined,
      message: 'network timeout',
    });
  });
});
