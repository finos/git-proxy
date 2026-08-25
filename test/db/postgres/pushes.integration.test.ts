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

import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeAudit,
  getPush,
  getPushes,
  deletePush,
  authorise,
  reject,
  cancel,
} from '../../../src/db/postgres/pushes';
import { Action } from '../../../src/proxy/actions';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

describe.runIf(shouldRunPostgresTests)('PostgreSQL Pushes Integration Tests', () => {
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
    it('writes an action to the database', async () => {
      const action = createTestAction({ id: 'write-audit-test' });
      await writeAudit(action);

      const retrieved = await getPush('write-audit-test');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('write-audit-test');
    });

    it('upserts an existing action', async () => {
      const action = createTestAction({ id: 'upsert-test' });
      await writeAudit(action);

      action.blocked = false;
      action.allowPush = true;
      await writeAudit(action);

      const retrieved = await getPush('upsert-test');
      expect(retrieved?.blocked).toBe(false);
      expect(retrieved?.allowPush).toBe(true);
    });

    it('throws Invalid id for non-string ids', async () => {
      const action = createTestAction();
      action.id = 123 as unknown as string;

      await expect(writeAudit(action)).rejects.toThrow('Invalid id');
    });

    it('strips _id from action before saving', async () => {
      const action = createTestAction({ id: 'strip-id-test' });
      (action as any)._id = 'should-be-removed';

      await writeAudit(action);
      const retrieved = await getPush('strip-id-test');
      expect(retrieved).not.toBeNull();
      // _id should not leak back out — the action JSON contains only public fields
      expect((retrieved as any)._id).toBeUndefined();
      expect(retrieved?.id).toBe('strip-id-test');
    });
  });

  describe('getPush', () => {
    it('retrieves a push by id', async () => {
      const action = createTestAction({ id: 'get-push-test' });
      await writeAudit(action);

      const result = await getPush('get-push-test');
      expect(result?.id).toBe('get-push-test');
      expect(result?.type).toBe('push');
    });

    it('returns null for a non-existent push', async () => {
      expect(await getPush('non-existent')).toBeNull();
    });

    it('returns an Action instance', async () => {
      const action = createTestAction({ id: 'action-instance-test' });
      await writeAudit(action);

      const result = await getPush('action-instance-test');
      expect(Object.getPrototypeOf(result)).toBe(Action.prototype);
    });
  });

  describe('getPushes', () => {
    beforeEach(async () => {
      // Three pushes with deliberately increasing timestamps so we can verify
      // DESC ordering deterministically.
      await writeAudit(
        createTestAction({
          id: 'push-a',
          timestamp: 1000,
          blocked: true,
          authorised: false,
        }),
      );
      await writeAudit(
        createTestAction({
          id: 'push-b',
          timestamp: 2000,
          blocked: true,
          authorised: false,
        }),
      );
      await writeAudit(
        createTestAction({
          id: 'push-authorised',
          timestamp: 3000,
          blocked: true,
          authorised: true,
        }),
      );
    });

    it('orders pushes by timestamp DESC', async () => {
      const result = await getPushes({});
      const ids = result.map((p) => p.id);
      expect(ids).toEqual(['push-authorised', 'push-b', 'push-a']);
    });

    it('filters by authorised flag', async () => {
      const result = await getPushes({ authorised: true });
      const authorisedPush = result.find((p) => p.id === 'push-authorised');
      expect(authorisedPush).toBeDefined();
      expect(result.every((p) => p.authorised === true)).toBe(true);
    });

    it('does not leak _id', async () => {
      const result = await getPushes({});
      result.forEach((push) => {
        expect((push as any)._id).toBeUndefined();
        expect(push.id).toBeDefined();
      });
    });
  });

  describe('deletePush', () => {
    it('deletes a push by id', async () => {
      const action = createTestAction({ id: 'delete-test' });
      await writeAudit(action);
      await deletePush('delete-test');
      expect(await getPush('delete-test')).toBeNull();
    });

    it('does not throw when deleting a non-existent push', async () => {
      await expect(deletePush('non-existent')).resolves.not.toThrow();
    });
  });

  describe('authorise', () => {
    it('authorises a push and resets cancel/reject flags', async () => {
      const action = createTestAction({
        id: 'authorise-test',
        authorised: false,
        canceled: true,
        rejected: true,
      });
      await writeAudit(action);

      const result = await authorise('authorise-test', { note: 'approved' } as never);
      expect(result.message).toBe('authorised authorise-test');

      const updated = await getPush('authorise-test');
      expect(updated?.authorised).toBe(true);
      expect(updated?.canceled).toBe(false);
      expect(updated?.rejected).toBe(false);
      expect((updated as any)?.attestation).toEqual({ note: 'approved' });
    });

    it('throws for a non-existent push', async () => {
      await expect(authorise('non-existent', {} as never)).rejects.toThrow(
        'push non-existent not found',
      );
    });
  });

  describe('reject', () => {
    it('rejects a push and persists the rejection payload', async () => {
      const action = createTestAction({
        id: 'reject-test',
        authorised: true,
        canceled: true,
        rejected: false,
      });
      await writeAudit(action);

      const rejection = {
        reason: 'policy violation',
        timestamp: new Date('2026-05-11T00:00:00Z'),
        reviewer: { username: 'r', reviewerEmail: 'r@example.com' },
      };

      const result = await reject('reject-test', rejection as never);
      expect(result.message).toBe('reject reject-test');

      const updated = await getPush('reject-test');
      expect(updated?.authorised).toBe(false);
      expect(updated?.canceled).toBe(false);
      expect(updated?.rejected).toBe(true);
      // Round-tripped through JSONB — `reason` and `reviewer` survive
      // exactly; the `Date` round-trips as an ISO string in JSON.
      expect((updated as any)?.rejection?.reason).toBe('policy violation');
      expect((updated as any)?.rejection?.reviewer).toEqual(rejection.reviewer);
    });

    it('throws for a non-existent push', async () => {
      await expect(reject('non-existent', {} as never)).rejects.toThrow(
        'push non-existent not found',
      );
    });
  });

  describe('cancel', () => {
    it('cancels a push and resets authorise/reject flags', async () => {
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

    it('throws for a non-existent push', async () => {
      await expect(cancel('non-existent')).rejects.toThrow('push non-existent not found');
    });
  });
});
