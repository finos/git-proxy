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
  await query('DROP TABLE IF EXISTS schema_migrations, repo_users, pushes, repos, users CASCADE');
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
    expect(versions.rows.map((row) => row.version)).toEqual([1, 2, 3, 4]);

    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN ('users', 'repos', 'pushes', 'repo_users')`,
    );
    expect(tables.rows.map((row) => row.tablename).sort()).toEqual([
      'pushes',
      'repo_users',
      'repos',
      'users',
    ]);
  });

  it('upgrades the users table to the version 2 shape on a fresh database', async () => {
    await resetToEmptyDatabase();
    await connect();

    const emailColumn = await query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'`,
    );
    expect(emailColumn.rows[0].is_nullable).toBe('YES');

    const publicKeysColumn = await query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'public_keys'`,
    );
    expect(publicKeysColumn.rows[0].data_type).toBe('jsonb');
  });

  it('is idempotent — re-running migrations does not duplicate the version row', async () => {
    await connect();
    await resetConnection();
    await connect();

    const versions = await query<{ version: number }>('SELECT version FROM schema_migrations');
    expect(versions.rows.map((row) => row.version)).toEqual([1, 2, 3, 4]);
  });
});
