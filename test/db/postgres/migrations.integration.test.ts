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

import { describe, it, expect } from 'vitest';

import { connect, query, resetConnection } from '../../../src/db/postgres/helper';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

// Drop everything so the next `connect()` exercises the migration runner from a
// genuinely empty database. The initial `query` self-bootstraps the schema; the
// DROP then clears it, and `resetConnection` releases the once-per-process latch
// so the following `connect()` re-runs migrations.
const resetToEmptyDatabase = async () => {
  await query('DROP TABLE IF EXISTS schema_migrations, pushes, repos, users CASCADE');
  await resetConnection();
};

describe.runIf(shouldRunPostgresTests)('PostgreSQL Schema Migration Integration Tests', () => {
  it('creates schema_migrations and the app tables and records version 1', async () => {
    await resetToEmptyDatabase();

    // First pool acquisition triggers the migration runner.
    await connect();

    const versions = await query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);

    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN ('users', 'repos', 'pushes')`,
    );
    expect(tables.rows.map((row) => row.tablename).sort()).toEqual(['pushes', 'repos', 'users']);
  });

  it('is idempotent — re-running migrations does not duplicate the version row', async () => {
    await connect();
    await resetConnection();
    await connect();

    const versions = await query<{ version: number }>('SELECT version FROM schema_migrations');
    expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);
  });
});
