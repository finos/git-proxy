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

import { Pool } from 'pg';

/**
 * A single, immutable schema change. Append new migrations with the next
 * `version`; never edit or reorder entries that have already shipped, since
 * deployed databases record which versions they have applied.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Ordered, append-only list of schema migrations.
 *
 * Version 1 is the initial schema. Because every statement uses
 * `CREATE TABLE/INDEX IF NOT EXISTS`, databases that were already bootstrapped
 * by the pre-migration code adopt the runner transparently: the statements are
 * no-ops and version 1 is simply recorded as applied.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
  CREATE TABLE IF NOT EXISTS users (
    _id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password      TEXT,
    git_account   TEXT NOT NULL,
    admin         BOOLEAN NOT NULL DEFAULT FALSE,
    oidc_id       TEXT UNIQUE,
    display_name  TEXT,
    title         TEXT
  );

  CREATE TABLE IF NOT EXISTS repos (
    _id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project  TEXT NOT NULL DEFAULT '',
    name     TEXT NOT NULL,
    url      TEXT NOT NULL UNIQUE,
    users    JSONB NOT NULL DEFAULT '{"canPush":[],"canAuthorise":[]}'::jsonb
  );
  CREATE INDEX IF NOT EXISTS repos_name_idx ON repos (name);

  CREATE TABLE IF NOT EXISTS pushes (
    id          TEXT PRIMARY KEY,
    timestamp   BIGINT NOT NULL,
    type        TEXT,
    error       BOOLEAN NOT NULL DEFAULT FALSE,
    blocked     BOOLEAN NOT NULL DEFAULT FALSE,
    allow_push  BOOLEAN NOT NULL DEFAULT FALSE,
    authorised  BOOLEAN NOT NULL DEFAULT FALSE,
    canceled    BOOLEAN NOT NULL DEFAULT FALSE,
    rejected    BOOLEAN NOT NULL DEFAULT FALSE,
    data        JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pushes_timestamp_idx ON pushes (timestamp DESC);
`,
  },
  {
    version: 2,
    name: 'user_public_keys_and_optional_email',
    sql: `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS public_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  -- Email uniqueness is best-effort, like the mongo/fs backends: a real
  -- address can only be claimed once, but any number of users may have no
  -- email (the AD "mail" attribute is optional, for instance).
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
    ON users (email) WHERE email IS NOT NULL AND email <> '';
`,
  },
  {
    version: 3,
    name: 'repo_users_table',
    sql: `
  CREATE TABLE IF NOT EXISTS repo_users (
    repo_id  UUID NOT NULL REFERENCES repos(_id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    role     TEXT NOT NULL CHECK (role IN ('canPush', 'canAuthorise')),
    PRIMARY KEY (repo_id, username, role)
  );
  CREATE INDEX IF NOT EXISTS repo_users_repo_id_idx ON repo_users (repo_id);

  -- Backfill the normalised table from the existing JSONB permissions. The
  -- legacy repos.users column is dropped in a later migration once the adapter
  -- reads and writes repo_users instead.
  INSERT INTO repo_users (repo_id, username, role)
  SELECT r._id, elem.username, 'canPush'
    FROM repos r,
         jsonb_array_elements_text(coalesce(r.users->'canPush', '[]'::jsonb)) AS elem(username)
  ON CONFLICT DO NOTHING;

  INSERT INTO repo_users (repo_id, username, role)
  SELECT r._id, elem.username, 'canAuthorise'
    FROM repos r,
         jsonb_array_elements_text(coalesce(r.users->'canAuthorise', '[]'::jsonb)) AS elem(username)
  ON CONFLICT DO NOTHING;
`,
  },
  {
    version: 4,
    name: 'drop_repos_users_jsonb',
    // The repo adapter now reads and writes permissions via repo_users, so the
    // legacy JSONB column (backfilled in migration 3) is no longer used.
    sql: `ALTER TABLE repos DROP COLUMN IF EXISTS users;`,
  },
];

const SCHEMA_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// Fixed, arbitrary advisory-lock key. Serialises migration runs across
// concurrently starting processes so each migration is applied exactly once.
const MIGRATION_ADVISORY_LOCK_KEY = 4815162342;

/**
 * Apply any not-yet-applied migrations in version order, inside a single
 * transaction guarded by a transaction-scoped advisory lock.
 *
 * Safe to call on every process start: already-applied migrations are skipped,
 * and concurrent callers block on the lock rather than racing. The lock is
 * acquired before the `schema_migrations` table is touched so two processes
 * booting against a brand-new database cannot both seed version 1.
 *
 * NOTE: all pending migrations run in one transaction, so a future statement
 * that cannot run transactionally (e.g. `CREATE INDEX CONCURRENTLY`) will need
 * dedicated handling — not required for the current schema.
 */
export const runMigrations = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Transaction-scoped lock; auto-released on COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    await client.query(SCHEMA_MIGRATIONS_TABLE_SQL);

    const { rows } = await client.query<{ version: number }>(
      'SELECT version FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.version));

    const pending = [...MIGRATIONS]
      .sort((a, b) => a.version - b.version)
      .filter((migration) => !applied.has(migration.version));

    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        migration.version,
        migration.name,
      ]);
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // best-effort rollback; the original error is rethrown below
    }
    throw err;
  } finally {
    client.release();
  }
};
