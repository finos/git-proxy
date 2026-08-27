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
const mockPoolOn = vi.fn();
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
    on = mockPoolOn;
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

    it('throws when no connection is configured', async () => {
      const PG_VARS = ['PGHOST', 'PGHOSTADDR', 'PGUSER', 'PGDATABASE'] as const;
      const saved = PG_VARS.map((v) => [v, process.env[v]] as const);
      for (const v of PG_VARS) delete process.env[v];
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      await expect(query('SELECT 1')).rejects.toThrow('Postgres connection is not configured');

      for (const [v, val] of saved) {
        if (val !== undefined) process.env[v] = val;
      }
    });

    it('accepts a PG* env setup that has no PGHOST (for example PGUSER/PGDATABASE)', async () => {
      const PG_VARS = ['PGHOST', 'PGHOSTADDR', 'PGUSER', 'PGDATABASE'] as const;
      const saved = PG_VARS.map((v) => [v, process.env[v]] as const);
      for (const v of PG_VARS) delete process.env[v];
      process.env.PGUSER = 'gitproxy';
      process.env.PGDATABASE = 'gitproxy';
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      await expect(query('SELECT 1')).resolves.toBeDefined();

      for (const [v, val] of saved) {
        if (val === undefined) delete process.env[v];
        else process.env[v] = val;
      }
    });
  });

  describe('connection config', () => {
    it('warns when a connection string overrides discrete fields', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
        host: 'ignored-host',
      });

      await query('SELECT 1');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ignoring the discrete'));
      warnSpy.mockRestore();
    });

    it('does not warn when only a connection string is set', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      await query('SELECT 1');

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('uses the connection string when provided', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({ connectionString: 'postgresql://localhost/x' });
    });

    it('builds the pool from discrete fields when no connection string is set', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'db.example.com',
        port: 5433,
        user: 'gp',
        password: 'secret',
        database: 'gitproxy',
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({
        host: 'db.example.com',
        port: 5433,
        user: 'gp',
        password: 'secret',
        database: 'gitproxy',
      });
    });

    it('prefers the connection string over discrete fields', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
        host: 'ignored',
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({ connectionString: 'postgresql://localhost/x' });
    });

    it('falls through to PG* env vars when the sink has no explicit connection', async () => {
      const savedPgHost = process.env.PGHOST;
      process.env.PGHOST = 'env-host';
      getDatabaseMock.mockReturnValue({ type: 'postgres', enabled: true });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({});
      if (savedPgHost === undefined) delete process.env.PGHOST;
      else process.env.PGHOST = savedPgHost;
    });
  });

  describe('ssl / TLS options', () => {
    it('applies ssl=true alongside a connection string', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
        ssl: true,
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({
        connectionString: 'postgresql://localhost/x',
        ssl: true,
      });
    });

    it('passes an ssl options object through to the pool', async () => {
      const ssl = { rejectUnauthorized: false, ca: 'CA_CERT' };
      getDatabaseMock.mockReturnValue({ type: 'postgres', enabled: true, host: 'db', ssl });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({ host: 'db', ssl });
    });
  });

  describe('pool tuning', () => {
    it('applies pool options on top of the connection', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
        pool: { max: 20, idleTimeoutMillis: 1000, connectionTimeoutMillis: 2000 },
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({
        connectionString: 'postgresql://localhost/x',
        max: 20,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 2000,
      });
    });

    it('only sets the pool options that are provided', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'db',
        pool: { max: 5 },
      });
      await connect();
      expect(mockPoolCtor).toHaveBeenCalledWith({ host: 'db', max: 5 });
    });
  });

  describe('pool error handling', () => {
    it('registers an idle-client error listener that logs without crashing', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await connect();

      const errorRegistration = mockPoolOn.mock.calls.find((call) => call[0] === 'error');
      expect(errorRegistration).toBeDefined();

      const handler = errorRegistration![1] as (err: Error) => void;
      expect(() => handler(new Error('connection terminated unexpectedly'))).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('getSessionStore', () => {
    it('throws when no connection is configured — no MemoryStore fallback', () => {
      // GitHub-hosted runners preset PGUSER/PGPASSWORD for their bundled
      // postgres tooling, and the connection guard honours the PG* family, so
      // every variable it reads must be cleared here.
      const PG_VARS = ['PGHOST', 'PGHOSTADDR', 'PGUSER', 'PGDATABASE'] as const;
      const saved = PG_VARS.map((v) => [v, process.env[v]] as const);
      for (const v of PG_VARS) delete process.env[v];
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      expect(() => getSessionStore()).toThrow(
        /Postgres connection is required for session storage/,
      );

      for (const [v, val] of saved) {
        if (val !== undefined) process.env[v] = val;
      }
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
