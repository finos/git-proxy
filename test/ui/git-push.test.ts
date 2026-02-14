import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPush,
  getPushes,
  authorisePush,
  cancelPush,
  rejectPush,
} from '../../src/ui/services/git-push';

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
  getApiV1BaseUrl: vi.fn(async () => 'http://localhost:8080/api/v1'),
}));

vi.mock('../../src/ui/services/auth', () => ({
  getAxiosConfig: vi.fn(() => ({
    withCredentials: true,
    headers: {},
  })),
  processAuthError: vi.fn(),
}));

describe('git-push service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPush', () => {
    it('returns push data with diff step on success', async () => {
      const pushData = {
        id: 'push-123',
        steps: [
          { stepName: 'diff', data: 'some diff' },
          { stepName: 'validate', data: 'validation data' },
        ],
      };

      axiosMock.mockResolvedValue({ data: pushData });

      const result = await getPush('push-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...pushData,
        diff: { stepName: 'diff', data: 'some diff' },
      });
      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/push/push-123',
        expect.any(Object),
      );
    });

    it('returns error result when getPush fails', async () => {
      axiosMock.mockRejectedValue({
        response: {
          status: 404,
          data: {
            message: 'Push not found',
          },
        },
      });

      const result = await getPush('push-123');

      expect(result).toEqual({
        success: false,
        status: 404,
        message: 'Push not found',
      });
    });

    it('uses fallback message when error has no response data', async () => {
      axiosMock.mockRejectedValue(new Error('Network error'));

      const result = await getPush('push-123');

      expect(result).toEqual({
        success: false,
        status: undefined,
        message: 'Network error',
      });
    });
  });

  describe('getPushes', () => {
    it('returns array of pushes on success with default query', async () => {
      const pushesData = [
        { id: 'push-1', steps: [] },
        { id: 'push-2', steps: [] },
      ];

      axiosMock.mockResolvedValue({ data: pushesData });

      const result = await getPushes();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(pushesData);
      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/push?blocked=true&canceled=false&authorised=false&rejected=false',
        expect.any(Object),
      );
    });

    it('returns array of pushes with custom query params', async () => {
      const pushesData = [{ id: 'push-1', steps: [] }];

      axiosMock.mockResolvedValue({ data: pushesData });

      const result = await getPushes({
        blocked: false,
        canceled: true,
        authorised: true,
        rejected: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(pushesData);
      expect(axiosMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/push?blocked=false&canceled=true&authorised=true&rejected=false',
        expect.any(Object),
      );
    });

    it('returns error result when getPushes fails', async () => {
      axiosMock.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
          },
        },
      });

      const result = await getPushes();

      expect(result).toEqual({
        success: false,
        status: 500,
        message: 'Internal server error',
      });
    });
  });

  describe('authorisePush', () => {
    it('returns success for authorise action', async () => {
      axiosMock.post.mockResolvedValue({ data: {} } as any);

      const result = await authorisePush('push-123', [{ label: 'LGTM', checked: true }]);

      expect(result).toEqual({ success: true });
      expect(axiosMock.post).toHaveBeenCalledWith(
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
      axiosMock.post.mockRejectedValue({
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
  });

  describe('rejectPush', () => {
    it('returns success for reject action', async () => {
      axiosMock.post.mockResolvedValue({ data: {} } as any);

      const result = await rejectPush('push-456');

      expect(result).toEqual({ success: true });
      expect(axiosMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/push/push-456/reject',
        {},
        expect.any(Object),
      );
    });

    it('returns backend message for reject 403 errors', async () => {
      axiosMock.post.mockRejectedValue({
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

    it('falls back to thrown error message when response payload is missing', async () => {
      axiosMock.post.mockRejectedValue(new Error('network timeout'));

      const result = await rejectPush('push-999');

      expect(result).toEqual({
        success: false,
        status: undefined,
        message: 'network timeout',
      });
    });
  });

  describe('cancelPush', () => {
    it('returns success for cancel action', async () => {
      axiosMock.post.mockResolvedValue({ data: {} } as any);

      const result = await cancelPush('push-789');

      expect(result).toEqual({ success: true });
      expect(axiosMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/push/push-789/cancel',
        {},
        expect.any(Object),
      );
    });

    it('returns backend message for cancel 401 errors', async () => {
      axiosMock.post.mockRejectedValue({
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
  });
});
