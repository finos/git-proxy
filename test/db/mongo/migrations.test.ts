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

const mockToArray = vi.fn();
const mockFind = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();

const mockConnect = vi.fn(() => ({
  find: mockFind,
  updateOne: mockUpdateOne,
  deleteOne: mockDeleteOne,
}));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
}));

describe('MongoDB migrations store', async () => {
  const { getAppliedMigrations, recordMigration, unrecordMigration } =
    await import('../../../src/db/mongo/migrations');

  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ toArray: mockToArray });
  });

  describe('getAppliedMigrations', () => {
    it('returns the ids of all applied migrations', async () => {
      mockToArray.mockResolvedValue([{ id: '20260701-alpha' }, { id: '20260702-bravo' }]);

      const result = await getAppliedMigrations();

      expect(mockConnect).toHaveBeenCalledWith('migrations');
      expect(mockFind).toHaveBeenCalledWith({});
      expect(result).toEqual(['20260701-alpha', '20260702-bravo']);
    });

    it('returns an empty array when no migrations are applied', async () => {
      mockToArray.mockResolvedValue([]);

      const result = await getAppliedMigrations();

      expect(result).toEqual([]);
    });
  });

  describe('recordMigration', () => {
    it('upserts the migration id', async () => {
      mockUpdateOne.mockResolvedValue({ acknowledged: true });

      await recordMigration('20260701-alpha');

      expect(mockConnect).toHaveBeenCalledWith('migrations');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: '20260701-alpha' },
        { $set: { id: '20260701-alpha' } },
        { upsert: true },
      );
    });
  });

  describe('unrecordMigration', () => {
    it('deletes the migration by id', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await unrecordMigration('20260701-alpha');

      expect(mockConnect).toHaveBeenCalledWith('migrations');
      expect(mockDeleteOne).toHaveBeenCalledWith({ id: '20260701-alpha' });
    });
  });
});
