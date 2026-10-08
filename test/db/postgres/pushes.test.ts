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

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../src/db/postgres/helper', () => ({
  query: mockQuery,
  // Runs the callback with a client whose query records into the same mock,
  // so tests assert the statement sequence; transactional semantics themselves
  // are covered by the withTransaction tests in helper.test.ts.
  withTransaction: (fn: (client: { query: typeof mockQuery }) => Promise<unknown>) =>
    fn({ query: mockQuery }),
}));

describe('PostgreSQL - Pushes', async () => {
  const {
    reject,
    getPushes,
    getPush,
    writeAudit,
    authorise,
    cancel,
    deletePush,
    getPushesForUserProfile,
    getRepoPushRollupsByCanonicalUrl,
  } = await import('../../../src/db/postgres/pushes');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPushes', () => {
    it('orders results by timestamp DESC', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushes({});

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/ORDER BY timestamp DESC/);
    });

    it('translates allowPush to the snake_case column', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushes({ allowPush: true });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('allow_push = $1');
      expect(params).toEqual([true]);
    });

    it('ignores unknown filter keys', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushes({ id: 'x' } as never);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([]);
    });
  });

  describe('getPush', () => {
    it('returns null when no row matches', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      expect(await getPush('missing')).toBeNull();
    });
  });

  describe('writeAudit', () => {
    it('throws Invalid id when id is not a string', async () => {
      const action = { id: 42, timestamp: 1 } as unknown as Parameters<typeof writeAudit>[0];
      await expect(writeAudit(action)).rejects.toThrow('Invalid id');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('upserts via ON CONFLICT (id)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      const action = {
        id: 'push-1',
        timestamp: 1234,
        type: 'push',
        error: false,
        blocked: true,
        allowPush: false,
        authorised: false,
        canceled: false,
        rejected: false,
      } as unknown as Parameters<typeof writeAudit>[0];

      await writeAudit(action);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    });
  });

  describe('reject', () => {
    it('persists rejection payload onto data JSONB', async () => {
      const rejection = {
        reason: 'fails policy',
        timestamp: new Date('2026-05-11T00:00:00Z'),
        reviewer: { username: 'r', reviewerEmail: 'r@example.com' },
      };

      // First call: locked read of the row inside the transaction.
      // Second call: the audit upsert on the same client.
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data: { id: 'p1', authorised: false, canceled: false, rejected: false } }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await reject('p1', rejection as never);

      expect(result).toEqual({ message: 'reject p1' });

      // The read must take a row lock so concurrent decisions serialise.
      expect(String(mockQuery.mock.calls[0][0])).toContain('FOR UPDATE');

      // The upsert call serializes the action (with rejection assigned) into
      // the final query parameter as JSON text.
      const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
      const dataJson = JSON.parse(upsertParams[9] as string);
      expect(dataJson).toMatchObject({
        id: 'p1',
        rejected: true,
        authorised: false,
        canceled: false,
        rejection: { reason: 'fails policy' },
      });
    });

    it('throws if push is not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await expect(reject('missing', {} as never)).rejects.toThrow('push missing not found');
    });
  });

  describe('authorise', () => {
    it('marks the push authorised and clears canceled/rejected', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data: { id: 'p1', authorised: false, canceled: true, rejected: true } }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await authorise('p1', { token: 't' } as never);

      expect(result).toEqual({ message: 'authorised p1' });
      const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
      const dataJson = JSON.parse(upsertParams[9] as string);
      expect(dataJson).toMatchObject({
        id: 'p1',
        authorised: true,
        canceled: false,
        rejected: false,
      });
    });

    it('throws if push is not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await expect(authorise('missing')).rejects.toThrow('push missing not found');
    });
  });

  describe('cancel', () => {
    it('marks the push canceled and clears authorised/rejected', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data: { id: 'p1', authorised: true, canceled: false, rejected: false } }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await cancel('p1');

      expect(result).toEqual({ message: 'canceled p1' });
      const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
      const dataJson = JSON.parse(upsertParams[9] as string);
      expect(dataJson).toMatchObject({
        id: 'p1',
        canceled: true,
        authorised: false,
        rejected: false,
      });
    });

    it('throws if push is not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await expect(cancel('missing')).rejects.toThrow('push missing not found');
    });
  });

  describe('deletePush', () => {
    it('issues a DELETE by id', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await deletePush('p1');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM pushes WHERE id = $1');
      expect(params).toEqual(['p1']);
    });
  });

  describe('list projection', () => {
    it('drops steps from list results but not from the detail view', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushes({});
      await getPushesForUserProfile([], 'alice');
      await getPush('p1');

      const [listSql] = mockQuery.mock.calls[0];
      const [profileSql] = mockQuery.mock.calls[1];
      const [detailSql] = mockQuery.mock.calls[2];
      expect(listSql).toContain("data - 'steps'");
      expect(profileSql).toContain("data - 'steps'");
      expect(detailSql).not.toContain("data - 'steps'");
    });
  });

  describe('getPushesForUserProfile', () => {
    it('matches the reviewer case-insensitively when there are no emails', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushesForUserProfile([], 'Alice');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("data->'attestation'->'reviewer'->>'username'");
      expect(sql).toMatch(/ORDER BY timestamp DESC/);
      expect(sql).not.toContain('userEmail');
      expect(params).toEqual(['Alice']);
    });

    it('matches either the author email variants or the reviewer', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getPushesForUserProfile(['a@b.com', 'A@B.com'], 'alice');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("(data->>'userEmail') = ANY($2::text[])");
      expect(sql).toContain(' OR ');
      expect(params).toEqual(['alice', ['a@b.com', 'A@B.com']]);
    });

    it('returns Action instances', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [{ data: { id: 'p1', url: 'https://github.com/a/b.git' } }],
      });

      const result = await getPushesForUserProfile([], 'alice');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
  });

  describe('getRepoPushRollupsByCanonicalUrl', () => {
    it('reads saved summaries without scanning unchanged push history', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ pending: false }] })
        .mockResolvedValueOnce({
          rows: [
            {
              key: 'example.com/a/b',
              counts: { pending: 1, approved: 2, rejected: 0, canceled: 0, error: 0 },
              latestPush: 200,
              latestPending: 100,
            },
          ],
        });
      const result = await getRepoPushRollupsByCanonicalUrl();
      expect(result.tabCounts.get('example.com/a/b')?.approved).toBe(2);
      expect(result.latestPushAtMs.get('example.com/a/b')).toBe(200);
      expect(result.latestPendingReviewAtMs.get('example.com/a/b')).toBe(100);
      expect(mockQuery.mock.calls.some(([sql]) => /FROM pushes\b/.test(sql))).toBe(false);
    });
  });
});
