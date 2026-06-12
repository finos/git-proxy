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

vi.mock('pg', () => {
  class Pool {
    constructor(opts: unknown) {
      mockPoolCtor(opts);
    }
    query = mockPoolQuery;
    end = mockPoolEnd;
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

// Stand in for the optional @aws-sdk/rds-signer dependency so the IAM token
// path can be exercised without real AWS credentials.
const mockGetAuthToken = vi.fn();
const mockSignerCtor = vi.fn();
vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: class {
    constructor(opts: unknown) {
      mockSignerCtor(opts);
    }
    getAuthToken = mockGetAuthToken;
  },
}));

describe('PostgreSQL - helper', async () => {
  const { connect, query, resetConnection, getSessionStore, ensureSessionStoreReady } =
    await import('../../../src/db/postgres/helper');

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetConnection();
    mockPoolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    mockGetAuthToken.mockResolvedValue('iam-token-123');
  });

  describe('connect / bootstrap', () => {
    it('runs the bootstrap SQL exactly once across many concurrent connects', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      await Promise.all([connect(), connect(), connect()]);

      // Pool constructed once, bootstrap SQL run once.
      expect(mockPoolCtor).toHaveBeenCalledTimes(1);
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockPoolQuery.mock.calls[0];
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS repos/);
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS pushes/);
    });

    it('retries bootstrap on the next call if it failed', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://localhost/x',
      });

      mockPoolQuery.mockRejectedValueOnce(new Error('schema kaboom'));

      await expect(connect()).rejects.toThrow('schema kaboom');

      // Second attempt re-runs bootstrap rather than being permanently
      // latched to the rejected promise.
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      await connect();
      expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    });

    it('throws when no connection is configured', async () => {
      const savedPgHost = process.env.PGHOST;
      delete process.env.PGHOST;
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      await expect(query('SELECT 1')).rejects.toThrow('Postgres connection is not configured');

      if (savedPgHost !== undefined) process.env.PGHOST = savedPgHost;
    });
  });

  describe('connection config', () => {
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

  describe('AWS RDS IAM authentication', () => {
    const getOpts = () => mockPoolCtor.mock.calls[0][0] as Record<string, any>;

    it('uses a generated IAM token as the password and defaults TLS on', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        port: 5432,
        user: 'gp',
        database: 'gitproxy',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();

      const opts = getOpts();
      expect(opts.host).toBe('rds.example.com');
      expect(opts.port).toBe(5432);
      expect(opts.user).toBe('gp');
      expect(opts.database).toBe('gitproxy');
      // RDS IAM mandates TLS, so it defaults on when ssl is not configured.
      expect(opts.ssl).toBe(true);
      // No static password — a token provider function instead.
      expect(opts.connectionString).toBeUndefined();
      expect(typeof opts.password).toBe('function');

      const token = await opts.password();
      expect(token).toBe('iam-token-123');
      expect(mockSignerCtor).toHaveBeenCalledWith({
        hostname: 'rds.example.com',
        port: 5432,
        username: 'gp',
        region: 'eu-west-2',
      });
    });

    it('respects an explicit ssl setting instead of forcing true', async () => {
      const ssl = { rejectUnauthorized: true, ca: 'RDS_CA' };
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        ssl,
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();
      expect(getOpts().ssl).toEqual(ssl);
    });

    it('ignores a connection string when IAM auth is enabled', async () => {
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://ignored/x',
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();
      const opts = getOpts();
      expect(opts.connectionString).toBeUndefined();
      expect(opts.host).toBe('rds.example.com');
      expect(typeof opts.password).toBe('function');
    });

    it('falls back to AWS_REGION when no region is configured', async () => {
      const savedRegion = process.env.AWS_REGION;
      process.env.AWS_REGION = 'us-east-1';
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true },
      });

      await connect();
      await getOpts().password();
      expect(mockSignerCtor).toHaveBeenCalledWith(expect.objectContaining({ region: 'us-east-1' }));

      if (savedRegion === undefined) delete process.env.AWS_REGION;
      else process.env.AWS_REGION = savedRegion;
    });

    it('throws a clear error when host or user cannot be resolved', async () => {
      const savedPgUser = process.env.PGUSER;
      delete process.env.PGUSER;
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await expect(connect()).rejects.toThrow(
        /AWS RDS IAM authentication requires `host` and `user`/,
      );

      if (savedPgUser !== undefined) process.env.PGUSER = savedPgUser;
    });

    it('propagates a token-generation failure to the connection', async () => {
      mockGetAuthToken.mockRejectedValueOnce(new Error('STS denied'));
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();
      await expect(getOpts().password()).rejects.toThrow('STS denied');
    });
  });

  describe('getSessionStore', () => {
    it('throws when no connection is configured — no MemoryStore fallback', () => {
      const savedPgHost = process.env.PGHOST;
      delete process.env.PGHOST;
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: undefined,
      });

      expect(() => getSessionStore()).toThrow(
        /Postgres connection is required for session storage/,
      );

      if (savedPgHost !== undefined) process.env.PGHOST = savedPgHost;
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
