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

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import session, { Store } from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { getDatabase } from '../../config';
import { runMigrations } from './schemaMigrations';

type DatabaseConfig = ReturnType<typeof getDatabase>;

let _pool: Pool | null = null;
let _bootstrapPromise: Promise<void> | null = null;

/**
 * True when some Postgres connection is configured: an explicit connection
 * string, the discrete `host` field, or any of the standard `PG*` environment
 * variables that identify a target (`PGHOST`, `PGHOSTADDR`, `PGUSER`,
 * `PGDATABASE`). Used to refuse startup loudly rather than silently defaulting
 * to `localhost`.
 */
const hasConnectionConfig = (db: DatabaseConfig): boolean =>
  Boolean(
    db.connectionString ||
    db.host ||
    process.env.PGHOST ||
    process.env.PGHOSTADDR ||
    process.env.PGUSER ||
    process.env.PGDATABASE,
  );

/**
 * Build a `pg` PoolConfig from the resolved database config. A connection
 * string (already env-resolved by `getDatabase`) takes precedence; otherwise
 * the discrete fields are used. When neither is set, `pg` reads the `PG*`
 * environment variables itself.
 */
const buildPoolConfig = (db: DatabaseConfig): PoolConfig => {
  const config: PoolConfig = {};
  if (db.connectionString) {
    if (
      db.host !== undefined ||
      db.port !== undefined ||
      db.user !== undefined ||
      db.password !== undefined ||
      db.database !== undefined
    ) {
      console.warn(
        '[postgres] connectionString is set; ignoring the discrete host/port/user/password/database fields',
      );
    }
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

  // Optional pool tuning.
  if (db.pool) {
    if (db.pool.max !== undefined) config.max = db.pool.max;
    if (db.pool.idleTimeoutMillis !== undefined) {
      config.idleTimeoutMillis = db.pool.idleTimeoutMillis;
    }
    if (db.pool.connectionTimeoutMillis !== undefined) {
      config.connectionTimeoutMillis = db.pool.connectionTimeoutMillis;
    }
  }
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
  // An idle client in the pool can emit 'error' (e.g. the backend dropped the
  // connection). Without a listener node treats this as an uncaught exception
  // and crashes the process; log it instead and let the pool recycle the client.
  _pool.on('error', (err) => {
    console.error('Postgres pool error on idle client:', err);
  });
  return _pool;
};

/**
 * Lazily resolves the pg Pool and runs any pending schema migrations exactly
 * once per process. All adapter modules acquire the pool through this function
 * so migrations complete before any query against `users` / `repos` / `pushes`
 * is executed.
 */
export const connect = async (): Promise<Pool> => {
  const pool = ensurePool();
  if (!_bootstrapPromise) {
    _bootstrapPromise = runMigrations(pool).catch((err) => {
      // Reset so the next caller retries instead of being permanently latched
      // onto a rejected promise.
      _bootstrapPromise = null;
      throw err;
    });
  }
  await _bootstrapPromise;
  return pool;
};

/**
 * Run `fn` inside a single transaction: every statement issued through the
 * supplied client commits or rolls back together. Used where one logical
 * update spans several statements, so a failure cannot leave partial state.
 */
export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const pool = await connect();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // the original error is the one worth surfacing
    }
    throw err;
  } finally {
    client.release();
  }
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
 * in any multi-process deployment. Throw loudly instead.
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
