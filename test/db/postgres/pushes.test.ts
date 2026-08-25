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

      // First call: getPush → resolves to a row whose data is the action.
      // Second call: writeAudit upsert.
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data: { id: 'p1', authorised: false, canceled: false, rejected: false } }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await reject('p1', rejection as never);

      expect(result).toEqual({ message: 'reject p1' });

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
    const row = (over: Record<string, unknown> = {}) => ({
      url: 'https://github.com/finos/git-proxy.git',
      error: false,
      rejected: false,
      canceled: false,
      authorised: false,
      blocked: true,
      allow_push: false,
      timestamp: 1000,
      ...over,
    });

    it('only scans push rows', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await getRepoPushRollupsByCanonicalUrl();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("WHERE type = 'push'");
    });

    it('counts pushes per canonical url and tracks the latest timestamps', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 2,
        rows: [row({ timestamp: 1000 }), row({ timestamp: 5000 })],
      });

      const { tabCounts, latestPushAtMs, latestPendingReviewAtMs } =
        await getRepoPushRollupsByCanonicalUrl();

      const [key] = [...tabCounts.keys()];
      expect(tabCounts.get(key)?.pending).toBe(2);
      expect(latestPushAtMs.get(key)).toBe(5000);
      expect(latestPendingReviewAtMs.get(key)).toBe(5000);
    });

    it('separates approved pushes from pending ones', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 2,
        rows: [row(), row({ authorised: true, blocked: false, timestamp: 9000 })],
      });

      const { tabCounts, latestPendingReviewAtMs } = await getRepoPushRollupsByCanonicalUrl();
      const [key] = [...tabCounts.keys()];

      expect(tabCounts.get(key)?.pending).toBe(1);
      expect(tabCounts.get(key)?.approved).toBe(1);
      // the approved push must not advance the pending-review timestamp
      expect(latestPendingReviewAtMs.get(key)).toBe(1000);
    });

    it('skips rows with an unusable url', async () => {
      mockQuery.mockResolvedValue({ rowCount: 2, rows: [row({ url: null }), row({ url: '' })] });

      const { tabCounts } = await getRepoPushRollupsByCanonicalUrl();

      expect(tabCounts.size).toBe(0);
    });

    it('parses BIGINT timestamps returned as strings', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [row({ timestamp: '4200' })] });

      const { latestPushAtMs } = await getRepoPushRollupsByCanonicalUrl();
      const [key] = [...latestPushAtMs.keys()];

      expect(latestPushAtMs.get(key)).toBe(4200);
    });

    it('ignores non-numeric timestamps', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [row({ timestamp: null })] });

      const { tabCounts, latestPushAtMs } = await getRepoPushRollupsByCanonicalUrl();

      expect(tabCounts.size).toBe(1);
      expect(latestPushAtMs.size).toBe(0);
    });
  });
});
