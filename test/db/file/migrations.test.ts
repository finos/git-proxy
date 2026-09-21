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

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as migrations from '../../../src/db/file/migrations';

describe('File DB migrations store', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      migrations.db.remove({}, { multi: true }, (err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns no applied migrations for a fresh store', async () => {
    expect(await migrations.getAppliedMigrations()).toEqual([]);
  });

  it('records a migration so it is reported as applied', async () => {
    await migrations.recordMigration('20260701-alpha');

    expect(await migrations.getAppliedMigrations()).toEqual(['20260701-alpha']);
  });

  it('reports multiple applied migrations', async () => {
    await migrations.recordMigration('20260701-alpha');
    await migrations.recordMigration('20260702-bravo');

    expect((await migrations.getAppliedMigrations()).sort()).toEqual([
      '20260701-alpha',
      '20260702-bravo',
    ]);
  });

  it('records the same migration idempotently', async () => {
    await migrations.recordMigration('20260701-alpha');
    await migrations.recordMigration('20260701-alpha');

    expect(await migrations.getAppliedMigrations()).toEqual(['20260701-alpha']);
  });

  it('unrecords a migration so it is no longer applied', async () => {
    await migrations.recordMigration('20260701-alpha');
    await migrations.recordMigration('20260702-bravo');

    await migrations.unrecordMigration('20260701-alpha');

    expect(await migrations.getAppliedMigrations()).toEqual(['20260702-bravo']);
  });

  it('unrecording an unknown migration is a no-op', async () => {
    await migrations.unrecordMigration('does-not-exist');

    expect(await migrations.getAppliedMigrations()).toEqual([]);
  });

  it('deriveCreatedAt always returns undefined', () => {
    expect(migrations.deriveCreatedAt()).toBeUndefined();
  });

  describe('error handling', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects getAppliedMigrations when the store errors', async () => {
      vi.spyOn(migrations.db, 'find').mockImplementation(((
        _query: unknown,
        cb: (err: Error | null, docs: unknown[]) => void,
      ) => cb(new Error('find failed'), [])) as any);

      await expect(migrations.getAppliedMigrations()).rejects.toThrow('find failed');
    });

    it('rejects recordMigration when the store errors', async () => {
      vi.spyOn(migrations.db, 'update').mockImplementation(((
        _query: unknown,
        _update: unknown,
        _options: unknown,
        cb: (err: Error | null) => void,
      ) => cb(new Error('update failed'))) as any);

      await expect(migrations.recordMigration('20260701-alpha')).rejects.toThrow('update failed');
    });

    it('rejects unrecordMigration when the store errors', async () => {
      vi.spyOn(migrations.db, 'remove').mockImplementation(((
        _query: unknown,
        _options: unknown,
        cb: (err: Error | null) => void,
      ) => cb(new Error('remove failed'))) as any);

      await expect(migrations.unrecordMigration('20260701-alpha')).rejects.toThrow('remove failed');
    });
  });
});
