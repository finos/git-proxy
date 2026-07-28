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
  const { reject, getPushes, getPush, writeAudit, authorise, cancel, deletePush } =
    await import('../../../src/db/postgres/pushes');

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
});
