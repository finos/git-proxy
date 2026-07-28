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

import { describe, it, expect, vi } from 'vitest';

import { runMigrations, MIGRATIONS } from '../../../src/db/postgres/migrations';

const SELECT_VERSIONS = /SELECT version FROM schema_migrations/;

// Build a fake pg Pool whose single client records every query. `appliedRows`
// is what the `SELECT version FROM schema_migrations` lookup returns.
const makePool = (appliedRows: { version: number }[] = []) => {
  const query = vi
    .fn()
    .mockImplementation((sql: string) =>
      SELECT_VERSIONS.test(sql)
        ? Promise.resolve({ rows: appliedRows, rowCount: appliedRows.length })
        : Promise.resolve({ rows: [], rowCount: 0 }),
    );
  const release = vi.fn();
  const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
  return { pool, query, release };
};

const sqlsOf = (query: ReturnType<typeof vi.fn>) => query.mock.calls.map((call) => String(call[0]));

describe('PostgreSQL - migrations', () => {
  it('exposes an ordered, append-only migration list starting at version 1', () => {
    expect(MIGRATIONS[0].version).toBe(1);

    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('locks, then creates schema_migrations, then commits — in that order', async () => {
    const { pool, query, release } = makePool([]);

    await runMigrations(pool as never);

    const sqls = sqlsOf(query);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[1]).toMatch(/pg_advisory_xact_lock/);
    expect(sqls[2]).toMatch(/CREATE TABLE IF NOT EXISTS schema_migrations/);
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('applies every pending migration and records its version', async () => {
    const { pool, query } = makePool([]);

    await runMigrations(pool as never);

    const inserts = query.mock.calls.filter((call) =>
      /INSERT INTO schema_migrations/.test(String(call[0])),
    );
    expect(inserts).toHaveLength(MIGRATIONS.length);
    expect(inserts[0][1]).toEqual([MIGRATIONS[0].version, MIGRATIONS[0].name]);

    // The migration body runs before its bookkeeping insert.
    const sqls = sqlsOf(query);
    expect(sqls).toContain(MIGRATIONS[0].sql);
  });

  it('skips migrations already recorded as applied', async () => {
    const allApplied = MIGRATIONS.map((m) => ({ version: m.version }));
    const { pool, query } = makePool(allApplied);

    await runMigrations(pool as never);

    const inserts = query.mock.calls.filter((call) =>
      /INSERT INTO schema_migrations/.test(String(call[0])),
    );
    expect(inserts).toHaveLength(0);
    expect(sqlsOf(query)).toContain('COMMIT');
  });

  it('rolls back and releases the client when a migration fails', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (SELECT_VERSIONS.test(sql)) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql === MIGRATIONS[0].sql) return Promise.reject(new Error('migration boom'));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    await expect(runMigrations(pool as never)).rejects.toThrow('migration boom');

    expect(sqlsOf(query)).toContain('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rethrows the original error even when ROLLBACK also fails', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (SELECT_VERSIONS.test(sql)) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql === MIGRATIONS[0].sql) return Promise.reject(new Error('migration boom'));
      if (sql === 'ROLLBACK') return Promise.reject(new Error('rollback boom'));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };

    // The migration failure must surface, not the secondary rollback failure.
    await expect(runMigrations(pool as never)).rejects.toThrow('migration boom');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
