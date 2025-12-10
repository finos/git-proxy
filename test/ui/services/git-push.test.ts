import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

describe('git-push service', () => {
  const originalLocation = globalThis.location;

  beforeAll(() => {
    globalThis.location = { origin: 'https://lovely-git-proxy.com' } as any;
    globalThis.localStorage = {
      getItem: vi.fn().mockResolvedValue(null),
    } as any;
    globalThis.document = {
      cookie: '',
    } as any;
  });

  afterAll(() => {
    globalThis.location = originalLocation;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rejectPush', () => {
    it('should return true when successfully rejected a push', async () => {
      const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });

      const { rejectPush } = await import('../../../src/ui/services/git-push');
      const setMessageSpy = vi.fn();

      const result = await rejectPush('test-push-id-123', setMessageSpy, {
        reason: 'tests do not pass',
      });

      expect(result).toBe(true);
      expect(setMessageSpy).toHaveBeenCalledExactlyOnceWith('');
      expect(axiosPostSpy).toHaveBeenCalledWith(
        'https://lovely-git-proxy.com/api/v1/push/test-push-id-123/reject',
        { params: { reason: 'tests do not pass' } },
        expect.any(Object),
      );
    });

    it('should return false when returns 401', async () => {
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };
      const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValue(error);

      const { rejectPush } = await import('../../../src/ui/services/git-push');
      const setMessageSpy = vi.fn();

      const result = await rejectPush('test-push-id-456', setMessageSpy, {
        reason: 'tests do not pass',
      });

      expect(result).toBe(false);
      expect(setMessageSpy).toHaveBeenCalledExactlyOnceWith('You are not authorised to reject...');
      expect(axiosPostSpy).toHaveBeenCalledOnce();
    });
  });

  describe('authorisePush', () => {
    it('should return true when authorised a push', async () => {
      const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({ status: 200 });

      const { authorisePush } = await import('../../../src/ui/services/git-push');
      const setMessageSpy = vi.fn();
      const attestation = [
        { label: 'Reviewed code', checked: true },
        { label: 'Verified tests', checked: true },
      ];

      const result = await authorisePush('test-push-id-789', setMessageSpy, attestation);

      expect(result).toBe(true);
      expect(setMessageSpy).toHaveBeenCalledExactlyOnceWith('');
      expect(axiosPostSpy).toHaveBeenCalledWith(
        'https://lovely-git-proxy.com/api/v1/push/test-push-id-789/authorise',
        { params: { attestation } },
        expect.any(Object),
      );
    });

    it('should return false when returned 401', async () => {
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };
      const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValue(error);

      const { authorisePush } = await import('../../../src/ui/services/git-push');
      const setMessageSpy = vi.fn();
      const attestation = [{ label: 'Reviewed code', checked: true }];

      const result = await authorisePush('test-push-id-101', setMessageSpy, attestation);

      expect(result).toBe(false);
      expect(setMessageSpy).toHaveBeenCalledExactlyOnceWith('You are not authorised to approve...');
      expect(axiosPostSpy).toHaveBeenCalledOnce();
    });
  });
});
