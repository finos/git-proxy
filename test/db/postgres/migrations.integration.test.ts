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
import { Pool } from 'pg';

import { connect, query, resetConnection } from '../../../src/db/postgres/helper';
import { MIGRATIONS, runMigrations } from '../../../src/db/postgres/migrations';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

// Mirrors the default in vitest.config.integration.postgres.ts. Used only by the
// backfill test below, which needs a raw pool to stage a pre-repo_users database.
const getConnectionString = () =>
  process.env.GIT_PROXY_POSTGRES_CONNECTION_STRING ||
  'postgresql://postgres:postgres@localhost:5432/git_proxy_test';

const migration = (version: number) => {
  const entry = MIGRATIONS.find((m) => m.version === version);
  if (!entry) throw new Error(`migration ${version} not found`);
  return entry;
};

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

  it('backfills existing JSONB repo permissions into repo_users (single, multi, same user in both roles)', async () => {
    // A raw pool lets us stage the pre-repo_users state: apply v1+v2 by hand and
    // record them as applied so `repos` still carries the legacy `users` JSONB
    // column, then seed data, then let the runner apply only v3 (create +
    // backfill) and v4 (drop column). Going through `connect()` instead would run
    // every migration up front and drop the column before we could seed it.
    const pool = new Pool({ connectionString: getConnectionString() });
    try {
      await pool.query(
        'DROP TABLE IF EXISTS schema_migrations, repo_users, pushes, repos, users CASCADE',
      );
      await pool.query(`
        CREATE TABLE schema_migrations (
          version     INTEGER PRIMARY KEY,
          name        TEXT NOT NULL,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      for (const version of [1, 2]) {
        const m = migration(version);
        await pool.query(m.sql);
        await pool.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
          m.version,
          m.name,
        ]);
      }

      // Seed legacy repos carrying populated JSONB permissions.
      const seed = async (name: string, users: { canPush: string[]; canAuthorise: string[] }) =>
        (
          await pool.query<{ _id: string }>(
            'INSERT INTO repos (name, url, users) VALUES ($1, $2, $3::jsonb) RETURNING _id',
            [name, `https://example.com/${name}.git`, JSON.stringify(users)],
          )
        ).rows[0]._id;

      const single = await seed('single', { canPush: ['alice'], canAuthorise: ['bob'] });
      const multi = await seed('multi', { canPush: ['amy', 'cara'], canAuthorise: ['dan'] });
      const both = await seed('both', { canPush: ['eve'], canAuthorise: ['eve'] });
      const empty = await seed('empty', { canPush: [], canAuthorise: [] });

      // Apply the remaining migrations: v3 creates repo_users + backfills, v4
      // drops the legacy column. The runner skips the already-recorded v1/v2.
      await runMigrations(pool);

      const versions = await pool.query<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      );
      expect(versions.rows.map((r) => r.version)).toEqual([1, 2, 3, 4]);

      // The legacy JSONB column is gone, dropped by v4.
      const usersCol = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'repos' AND column_name = 'users'`,
      );
      expect(usersCol.rowCount).toBe(0);

      // Every JSONB entry was backfilled, one row per (repo, user, role).
      const permsOf = async (id: string) =>
        (
          await pool.query<{ username: string; role: string }>(
            'SELECT username, role FROM repo_users WHERE repo_id = $1 ORDER BY role, username',
            [id],
          )
        ).rows;

      expect(await permsOf(single)).toEqual([
        { username: 'bob', role: 'canAuthorise' },
        { username: 'alice', role: 'canPush' },
      ]);
      expect(await permsOf(multi)).toEqual([
        { username: 'dan', role: 'canAuthorise' },
        { username: 'amy', role: 'canPush' },
        { username: 'cara', role: 'canPush' },
      ]);
      // A user listed in both roles becomes two PK-distinct rows.
      expect(await permsOf(both)).toEqual([
        { username: 'eve', role: 'canAuthorise' },
        { username: 'eve', role: 'canPush' },
      ]);
      // A repo with no permissions backfills nothing.
      expect(await permsOf(empty)).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
