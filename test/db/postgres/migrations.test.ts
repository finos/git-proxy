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

describe('PostgreSQL - Migrations', async () => {
  const { deriveCreatedAt, getAppliedMigrations, recordMigration, unrecordMigration } =
    await import('../../../src/db/postgres/migrations');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deriveCreatedAt', () => {
    it('cannot recover a timestamp from a random UUID', () => {
      // Same contract as the filesystem backend: callers fall back to their own default.
      expect(deriveCreatedAt()).toBeUndefined();
    });
  });

  describe('getAppliedMigrations', () => {
    it('returns the recorded ids', async () => {
      mockQuery.mockResolvedValue({ rowCount: 2, rows: [{ id: '001-a' }, { id: '002-b' }] });

      await expect(getAppliedMigrations()).resolves.toEqual(['001-a', '002-b']);
    });

    it('returns an empty list on a fresh database', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      await expect(getAppliedMigrations()).resolves.toEqual([]);
    });
  });

  describe('recordMigration', () => {
    it('is idempotent so an interrupted run can resume', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await recordMigration('001-a');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO migrations');
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
      expect(params).toEqual(['001-a']);
    });
  });

  describe('unrecordMigration', () => {
    it('deletes only the given id', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await unrecordMigration('001-a');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM migrations WHERE id = $1');
      expect(params).toEqual(['001-a']);
    });
  });
});
