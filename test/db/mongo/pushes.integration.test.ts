import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeAudit,
  getPush,
  getPushes,
  deletePush,
  authorise,
  reject,
  cancel,
} from '../../../src/db/mongo/pushes';
import { Action } from '../../../src/proxy/actions';

const shouldRunMongoTests = process.env.RUN_MONGO_TESTS === 'true';

describe.runIf(shouldRunMongoTests)('MongoDB Pushes Integration Tests', () => {
  const createTestAction = (overrides: Partial<Action> = {}): Action => {
    const timestamp = Date.now();
    const action = new Action(
      overrides.id || `test-push-${timestamp}`,
      overrides.type || 'push',
      overrides.method || 'POST',
      overrides.timestamp || timestamp,
      overrides.url || 'https://github.com/test/repo.git',
    );

    action.error = overrides.error ?? false;
    action.blocked = overrides.blocked ?? true;
    action.allowPush = overrides.allowPush ?? false;
    action.authorised = overrides.authorised ?? false;
    action.canceled = overrides.canceled ?? false;
    action.rejected = overrides.rejected ?? false;

    return action;
  };

  describe('writeAudit', () => {
    it('should write an action to the database', async () => {
      const action = createTestAction({ id: 'write-audit-test' });

      await writeAudit(action);

      const retrieved = await getPush('write-audit-test');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('write-audit-test');
    });

    it('should upsert an existing action', async () => {
      const action = createTestAction({ id: 'upsert-test' });
      await writeAudit(action);

      action.blocked = false;
      action.allowPush = true;
      await writeAudit(action);

      const retrieved = await getPush('upsert-test');
      expect(retrieved?.blocked).toBe(false);
      expect(retrieved?.allowPush).toBe(true);
    });

    it('should throw error for invalid id', async () => {
      const action = createTestAction();
      (action as any).id = 123;

      await expect(writeAudit(action)).rejects.toThrow('Invalid id');
    });

    it('should strip _id from action before saving', async () => {
      const action = createTestAction({ id: 'strip-id-test' });
      (action as any)._id = 'should-be-removed';

      await writeAudit(action);

      const retrieved = await getPush('strip-id-test');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('strip-id-test');
    });
  });

  describe('getPush', () => {
    it('should retrieve a push by id', async () => {
      const action = createTestAction({ id: 'get-push-test' });
      await writeAudit(action);

      const result = await getPush('get-push-test');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('get-push-test');
      expect(result?.type).toBe('push');
    });

    it('should return null for non-existent push', async () => {
      const result = await getPush('non-existent-push');

      expect(result).toBeNull();
    });

    it('should return an Action instance', async () => {
      const action = createTestAction({ id: 'action-instance-test' });
      await writeAudit(action);

      const result = await getPush('action-instance-test');

      expect(Object.getPrototypeOf(result)).toBe(Action.prototype);
    });
  });

  describe('getPushes', () => {
    beforeEach(async () => {
      await writeAudit(
        createTestAction({
          id: 'push-list-1',
          blocked: true,
          allowPush: false,
          authorised: false,
          error: false,
        }),
      );
      await writeAudit(
        createTestAction({
          id: 'push-list-2',
          blocked: true,
          allowPush: false,
          authorised: false,
          error: false,
        }),
      );
      await writeAudit(
        createTestAction({
          id: 'push-authorised',
          blocked: true,
          allowPush: false,
          authorised: true,
          error: false,
        }),
      );
    });

    it('should retrieve pushes matching default query', async () => {
      const result = await getPushes();

      const matchingPushes = result.filter((p) => ['push-list-1', 'push-list-2'].includes(p.id));
      expect(matchingPushes.length).toBe(2);
    });

    it('should filter pushes by custom query', async () => {
      const result = await getPushes({ authorised: true });

      const authorisedPush = result.find((p) => p.id === 'push-authorised');
      expect(authorisedPush).toBeDefined();
    });

    it('should return projected fields only', async () => {
      const result = await getPushes();

      result.forEach((push) => {
        expect((push as any)._id).toBeUndefined();
        expect(push.id).toBeDefined();
      });
    });
  });

  describe('deletePush', () => {
    it('should delete a push by id', async () => {
      const action = createTestAction({ id: 'delete-test' });
      await writeAudit(action);

      await deletePush('delete-test');

      const result = await getPush('delete-test');
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent push', async () => {
      await expect(deletePush('non-existent')).resolves.not.toThrow();
    });
  });

  describe('authorise', () => {
    it('should authorise a push and update flags', async () => {
      const action = createTestAction({
        id: 'authorise-test',
        authorised: false,
        canceled: true,
        rejected: true,
      });
      await writeAudit(action);

      const result = await authorise('authorise-test', { note: 'approved' });

      expect(result.message).toBe('authorised authorise-test');

      const updated = await getPush('authorise-test');
      expect(updated?.authorised).toBe(true);
      expect(updated?.canceled).toBe(false);
      expect(updated?.rejected).toBe(false);
      expect(updated?.attestation).toEqual({ note: 'approved' });
    });

    it('should throw error for non-existent push', async () => {
      await expect(authorise('non-existent', {})).rejects.toThrow('push non-existent not found');
    });
  });

  describe('reject', () => {
    it('should reject a push and update flags', async () => {
      const action = createTestAction({
        id: 'reject-test',
        authorised: true,
        canceled: true,
        rejected: false,
      });
      await writeAudit(action);

      const result = await reject('reject-test', { reason: 'policy violation' });

      expect(result.message).toBe('reject reject-test');

      const updated = await getPush('reject-test');
      expect(updated?.authorised).toBe(false);
      expect(updated?.canceled).toBe(false);
      expect(updated?.rejected).toBe(true);
      expect(updated?.rejection).toEqual({ reason: 'policy violation' });
    });

    it('should throw error for non-existent push', async () => {
      await expect(reject('non-existent', {})).rejects.toThrow('push non-existent not found');
    });
  });

  describe('cancel', () => {
    it('should cancel a push and update flags', async () => {
      const action = createTestAction({
        id: 'cancel-test',
        authorised: true,
        canceled: false,
        rejected: true,
      });
      await writeAudit(action);

      const result = await cancel('cancel-test');

      expect(result.message).toBe('canceled cancel-test');

      const updated = await getPush('cancel-test');
      expect(updated?.authorised).toBe(false);
      expect(updated?.canceled).toBe(true);
      expect(updated?.rejected).toBe(false);
    });

    it('should throw error for non-existent push', async () => {
      await expect(cancel('non-existent')).rejects.toThrow('push non-existent not found');
    });
  });
});
