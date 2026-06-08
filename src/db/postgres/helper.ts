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

import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import session, { Store } from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { getDatabase } from '../../config';

type DatabaseConfig = ReturnType<typeof getDatabase>;

let _pool: Pool | null = null;
let _bootstrapPromise: Promise<void> | null = null;

/**
 * True when some Postgres connection is configured: an explicit connection
 * string, the discrete `host` field, or the standard `PGHOST` environment
 * variable (which implies the `PG*` family is in use). Used to refuse startup
 * loudly rather than silently defaulting to `localhost`.
 */
const hasConnectionConfig = (db: DatabaseConfig): boolean =>
  Boolean(db.connectionString || db.host || process.env.PGHOST);

/**
 * Build a `pg` PoolConfig from the resolved database config. A connection
 * string (already env-resolved by `getDatabase`) takes precedence; otherwise
 * the discrete fields are used. When neither is set, `pg` reads the `PG*`
 * environment variables itself.
 */
const buildPoolConfig = (db: DatabaseConfig): PoolConfig => {
  const config: PoolConfig = {};
  if (db.connectionString) {
    config.connectionString = db.connectionString;
  } else {
    if (db.host !== undefined) config.host = db.host;
    if (db.port !== undefined) config.port = db.port;
    if (db.user !== undefined) config.user = db.user;
    if (db.password !== undefined) config.password = db.password;
    if (db.database !== undefined) config.database = db.database;
  }
  // TLS applies regardless of how the connection itself was configured.
  if (db.ssl !== undefined) config.ssl = db.ssl as PoolConfig['ssl'];
  return config;
};

const ensurePool = (): Pool => {
  if (_pool) return _pool;

  const db = getDatabase();
  if (!hasConnectionConfig(db)) {
    throw new Error(
      'Postgres connection is not configured (set connectionString, the host/port/user/password/database fields, or the PG* environment variables)',
    );
  }

  _pool = new Pool(buildPoolConfig(db));
  return _pool;
};

const APP_SCHEMA_SQL = `
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
`;

const bootstrapAppSchema = async (pool: Pool): Promise<void> => {
  await pool.query(APP_SCHEMA_SQL);
};

/**
 * Lazily resolves the pg Pool and runs the app schema bootstrap exactly once
 * per process. All adapter modules acquire the pool through this function so
 * the bootstrap completes before any query against `users` / `repos` / `pushes`
 * is executed.
 */
export const connect = async (): Promise<Pool> => {
  const pool = ensurePool();
  if (!_bootstrapPromise) {
    _bootstrapPromise = bootstrapAppSchema(pool).catch((err) => {
      // Reset so the next caller retries instead of being permanently latched
      // onto a rejected promise.
      _bootstrapPromise = null;
      throw err;
    });
  }
  await _bootstrapPromise;
  return pool;
};

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> => {
  const pool = await connect();
  return pool.query<T>(text, params as unknown[] | undefined);
};

/**
 * Reset the pool and bootstrap latch — exported for test cleanup.
 */
export const resetConnection = async (): Promise<void> => {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
  _bootstrapPromise = null;
};

/**
 * Build an express-session Store backed by Postgres via `connect-pg-simple`.
 *
 * IMPORTANT: this function MUST NOT silently return undefined when Postgres is
 * the active sink — that would cause express-session to fall back to its
 * default in-memory store, which loses sessions on every restart and is unsafe
 * in any multi-process deployment. Issue #1497 calls this out as a must-fix
 * requirement, so we throw loudly instead.
 */
export const getSessionStore = (): Store => {
  if (!hasConnectionConfig(getDatabase())) {
    throw new Error(
      'Postgres connection is required for session storage (set connectionString, the host/port/user/password/database fields, or the PG* environment variables)',
    );
  }

  const pool = ensurePool();
  const PgStore = connectPgSimple(session);
  return new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
};

export const ensureSessionStoreReady = async (): Promise<void> => {
  const store = getSessionStore();

  await new Promise<void>((resolve, reject) => {
    store.get('__git_proxy_session_startup_probe__', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  const maybeClosableStore = store as Store & { close?: () => Promise<void> };
  if (maybeClosableStore.close) {
    await maybeClosableStore.close();
  }
};
