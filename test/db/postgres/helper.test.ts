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

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPoolQuery = vi.fn();
const mockPoolEnd = vi.fn();
const mockPoolCtor = vi.fn();
const mockPoolConnect = vi.fn();
const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();

vi.mock('pg', () => {
  class Pool {
    constructor(opts: unknown) {
      mockPoolCtor(opts);
    }
    query = mockPoolQuery;
    end = mockPoolEnd;
    connect = mockPoolConnect;
  }
  return { Pool };
});

// connect-pg-simple returns a constructor that accepts options including a
// `pool` instance. We don't exercise the real store — just want to capture the
// options the helper passes.
const mockStoreCtor = vi.fn();
vi.mock('connect-pg-simple', () => ({
  default: () =>
    class FakePgStore {
      constructor(opts: unknown) {
        mockStoreCtor(opts);
      }
      get(_sid: string, cb: (err: Error | null) => void) {
        mockPoolQuery('SELECT 1', []);
        cb(null);
      }
      close() {
        return Promise.resolve();
      }
    },
}));

const getDatabaseMock = vi.fn();
vi.mock('../../../src/config', () => ({
  getDatabase: getDatabaseMock,
}));

describe('PostgreSQL - helper', async () => {
  const { connect, query, resetConnection, getSessionStore, ensureSessionStoreReady } =
    await import('../../../src/db/postgres/helper');

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetConnection();
    mockPoolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    mockClientQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    mockPoolConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
  });

  describe('connect / migrations', () => {
    it('runs migrations exactly once across many concurrent connects', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      await Promise.all([connect(), connect(), connect()]);

      // Pool constructed once; a single client acquired to run migrations once.
      expect(mockPoolCtor).toHaveBeenCalledTimes(1);
      expect(mockPoolConnect).toHaveBeenCalledTimes(1);

      const sqls = mockClientQuery.mock.calls.map((call) => String(call[0]));
      expect(sqls[0]).toBe('BEGIN');
      expect(sqls.some((sql) => /pg_advisory_xact_lock/.test(sql))).toBe(true);
      expect(sqls.some((sql) => /CREATE TABLE IF NOT EXISTS schema_migrations/.test(sql))).toBe(
        true,
      );
      expect(sqls.some((sql) => /CREATE TABLE IF NOT EXISTS users/.test(sql))).toBe(true);
      expect(sqls[sqls.length - 1]).toBe('COMMIT');
    });

    it('retries migrations on the next call if they failed', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      // First migration run rejects on its opening statement.
      mockClientQuery.mockRejectedValueOnce(new Error('schema kaboom'));

      await expect(connect()).rejects.toThrow('schema kaboom');

      // The latch is cleared on failure, so the next connect re-runs migrations
      // rather than being permanently latched to the rejected promise.
      await connect();
      expect(mockPoolConnect).toHaveBeenCalledTimes(2);
    });

    it('throws when the connection string is missing', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      await expect(query('SELECT 1')).rejects.toThrow('Postgres connection string is not provided');
    });
  });

  describe('getSessionStore', () => {
    it('throws when connection string is missing — no MemoryStore fallback', () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      expect(() => getSessionStore()).toThrow(
        /Postgres connection string is required for session storage/,
      );
    });

    it('passes the shared pool to connect-pg-simple with createTableIfMissing', () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      getSessionStore();

      expect(mockStoreCtor).toHaveBeenCalledTimes(1);
      const opts = mockStoreCtor.mock.calls[0][0] as Record<string, unknown>;
      expect(opts.tableName).toBe('session');
      expect(opts.createTableIfMissing).toBe(true);
      expect(opts.pool).toBeDefined();
    });

    it('touches the session store during readiness checks', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      await ensureSessionStoreReady();

      expect(mockStoreCtor).toHaveBeenCalledTimes(1);
      expect(mockPoolQuery).toHaveBeenCalled();
    });
  });
});
