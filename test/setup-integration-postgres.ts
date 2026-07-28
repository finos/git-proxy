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

import { beforeAll, afterAll, afterEach } from 'vitest';
import { Client } from 'pg';

import { resetConnection } from '../src/db/postgres/helper';
import { invalidateCache } from '../src/config';

const DEFAULT_CONNECTION_STRING = 'postgresql://postgres:postgres@localhost:5432/git_proxy_test';
const APP_TABLES = ['pushes', 'repos', 'users'];
const SESSION_TABLE = 'session';

let client: Client | null = null;

const getConnectionString = () =>
  process.env.GIT_PROXY_POSTGRES_CONNECTION_STRING || DEFAULT_CONNECTION_STRING;

const shouldRun = () => process.env.RUN_POSTGRES_TESTS === 'true';

beforeAll(async () => {
  if (!shouldRun()) return;

  try {
    client = new Client({ connectionString: getConnectionString() });
    await client.connect();
    console.log(`PostgreSQL connection established for integration tests`);
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
});

afterEach(async () => {
  if (client) {
    // Truncate app tables so each test starts from a known clean state.
    // RESTART IDENTITY isn't needed (UUID PKs), but CASCADE keeps us future-
    // proof in case a follow-up commit adds FK relationships.
    try {
      await client.query(`TRUNCATE TABLE ${APP_TABLES.join(', ')} CASCADE`);
    } catch (error) {
      console.warn('Failed to truncate app tables during integration test cleanup', error);
    }
    try {
      // The session table is created lazily by connect-pg-simple; ignore the
      // error if it does not yet exist.
      await client.query(`TRUNCATE TABLE "${SESSION_TABLE}"`);
    } catch {
      // intentionally swallowed — table may not exist yet
    }
  }

  try {
    await resetConnection();
  } catch (error) {
    console.warn('Failed to reset Postgres pool during integration test cleanup', error);
  }
  invalidateCache();
});

afterAll(async () => {
  try {
    await resetConnection();
  } catch (error) {
    console.warn('Failed to reset Postgres pool during integration test cleanup', error);
  }

  if (client) {
    try {
      for (const table of APP_TABLES) {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
      await client.query(`DROP TABLE IF EXISTS "${SESSION_TABLE}"`);
    } catch (error) {
      console.warn('Failed to drop Postgres test tables during cleanup', error);
    }
    await client.end();
    client = null;
  }

  console.log('PostgreSQL integration test cleanup complete');
});
