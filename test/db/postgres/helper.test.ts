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

    it('warns that the connection string is ignored when IAM auth is enabled', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        connectionString: 'postgresql://ignored/x',
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ignoring connectionString'));
      warnSpy.mockRestore();
    });

    it('warns when ssl defaults to true in IAM mode (RDS CA is not in the default trust store)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ssl.ca'));
      warnSpy.mockRestore();
    });

    it('does not warn about ssl when a CA bundle is supplied', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        ssl: { rejectUnauthorized: true, ca: 'RDS_CA' },
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();

      const sslWarnings = warnSpy.mock.calls.filter(([m]) => String(m).includes('ssl.ca'));
      expect(sslWarnings).toEqual([]);
      warnSpy.mockRestore();
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

    it('falls back to AWS_DEFAULT_REGION when AWS_REGION is unset', async () => {
      const savedRegion = process.env.AWS_REGION;
      const savedDefault = process.env.AWS_DEFAULT_REGION;
      delete process.env.AWS_REGION;
      process.env.AWS_DEFAULT_REGION = 'ap-south-1';
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true },
      });

      await connect();
      await getOpts().password();
      expect(mockSignerCtor).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-south-1' }),
      );

      if (savedRegion === undefined) delete process.env.AWS_REGION;
      else process.env.AWS_REGION = savedRegion;
      if (savedDefault === undefined) delete process.env.AWS_DEFAULT_REGION;
      else process.env.AWS_DEFAULT_REGION = savedDefault;
    });

    it('prefers AWS_REGION over AWS_DEFAULT_REGION', async () => {
      const savedRegion = process.env.AWS_REGION;
      const savedDefault = process.env.AWS_DEFAULT_REGION;
      process.env.AWS_REGION = 'us-west-2';
      process.env.AWS_DEFAULT_REGION = 'ap-south-1';
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true },
      });

      await connect();
      await getOpts().password();
      expect(mockSignerCtor).toHaveBeenCalledWith(expect.objectContaining({ region: 'us-west-2' }));

      if (savedRegion === undefined) delete process.env.AWS_REGION;
      else process.env.AWS_REGION = savedRegion;
      if (savedDefault === undefined) delete process.env.AWS_DEFAULT_REGION;
      else process.env.AWS_DEFAULT_REGION = savedDefault;
    });

    it('defaults the IAM token port to 5432 when none is configured', async () => {
      const savedPgPort = process.env.PGPORT;
      delete process.env.PGPORT;
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await connect();
      await getOpts().password();
      expect(mockSignerCtor).toHaveBeenCalledWith(expect.objectContaining({ port: 5432 }));

      if (savedPgPort !== undefined) process.env.PGPORT = savedPgPort;
    });

    it('throws an actionable error when @aws-sdk/rds-signer is not installed', async () => {
      // Re-import the helper against a registry where the optional dependency
      // fails to resolve, to exercise loadRdsSigner's catch branch — the exact
      // failure a user hits after `npm install --omit=optional`.
      vi.resetModules();
      vi.doMock('@aws-sdk/rds-signer', () => {
        throw new Error('Cannot find module');
      });

      const fresh = await import('../../../src/db/postgres/helper');
      getDatabaseMock.mockReturnValue({
        type: 'postgres',
        enabled: true,
        host: 'rds.example.com',
        user: 'gp',
        awsIamAuth: { enabled: true, region: 'eu-west-2' },
      });

      await fresh.connect();
      const opts = mockPoolCtor.mock.calls[0][0] as Record<string, any>;
      await expect(opts.password()).rejects.toThrow(
        /requires the optional `@aws-sdk\/rds-signer` dependency/,
      );

      await fresh.resetConnection();
      vi.doUnmock('@aws-sdk/rds-signer');
      vi.resetModules();
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
