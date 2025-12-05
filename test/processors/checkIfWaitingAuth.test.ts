import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Action } from '../../src/proxy/actions';
import * as checkIfWaitingAuthModule from '../../src/proxy/processors/push-action/checkIfWaitingAuth';

vi.mock('../../src/db', () => ({
  getPush: vi.fn(),
}));
import { getPush } from '../../src/db';

describe('checkIfWaitingAuth', () => {
  const getPushMock = vi.mocked(getPush);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exec', () => {
    let action: Action;
    let req: any;

    beforeEach(() => {
      req = {};
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    });

    it('should set allowPush when action exists and is authorized', async () => {
      const authorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      authorizedAction.authorised = true;
      getPushMock.mockResolvedValue(authorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(true);
      expect(result).toEqual(authorizedAction);
    });

    it('should not set allowPush when action exists but not authorized', async () => {
      const unauthorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      unauthorizedAction.authorised = false;
      getPushMock.mockResolvedValue(unauthorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
    });

    it('should not set allowPush when action does not exist', async () => {
      getPushMock.mockResolvedValue(null);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
    });

    it('should not modify action when it has an error', async () => {
      action.error = true;
      const authorizedAction = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git',
      );
      authorizedAction.authorised = true;
      getPushMock.mockResolvedValue(authorizedAction);

      const result = await checkIfWaitingAuthModule.exec(req, action);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.allowPush).toBe(false);
      expect(result.error).toBe(true);
    });

    it('should add step with error when getPush throws', async () => {
      const error = new Error('DB error');
      getPushMock.mockRejectedValue(error);

      await expect(checkIfWaitingAuthModule.exec(req, action)).rejects.toThrow(error);

      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].error).toBe(true);
      expect(action.steps[0].errorMessage).toContain('DB error');
    });
  });
});
