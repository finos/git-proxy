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

import { Pool, QueryResult, QueryResultRow } from 'pg';
import session, { Store } from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { getDatabase } from '../../config';
import { runMigrations } from './migrations';

let _pool: Pool | null = null;
let _bootstrapPromise: Promise<void> | null = null;

const ensurePool = (): Pool => {
  if (_pool) return _pool;

  const connectionString = getDatabase().connectionString;
  if (!connectionString) {
    throw new Error('Postgres connection string is not provided');
  }

  _pool = new Pool({ connectionString });
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
  const connectionString = getDatabase().connectionString;
  if (!connectionString) {
    throw new Error(
      'Postgres connection string is required for session storage (set it in `sink[].connectionString` or via GIT_PROXY_POSTGRES_CONNECTION_STRING)',
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
