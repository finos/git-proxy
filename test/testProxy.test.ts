import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';

vi.mock('http', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createServer: vi.fn(() => ({
      listen: vi.fn((port: number, cb: () => void) => {
        cb();
        return { close: vi.fn((cb) => cb()) };
      }),
      close: vi.fn((cb: () => void) => cb()),
    })),
  };
});

vi.mock('https', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createServer: vi.fn(() => ({
      listen: vi.fn((port: number, cb: () => void) => {
        cb();
        return { close: vi.fn((cb) => cb()) };
      }),
      close: vi.fn((cb: () => void) => cb()),
    })),
  };
});

vi.mock('../src/proxy/routes', () => ({
  getRouter: vi.fn(),
}));

vi.mock('../src/config', () => ({
  getTLSEnabled: vi.fn(),
  getTLSKeyPemPath: vi.fn(),
  getTLSCertPemPath: vi.fn(),
  getPlugins: vi.fn(),
  getAuthorisedList: vi.fn(),
}));

vi.mock('../src/db', () => ({
  getRepos: vi.fn(),
  createRepo: vi.fn(),
  addUserCanPush: vi.fn(),
  addUserCanAuthorise: vi.fn(),
}));

vi.mock('../src/plugin', () => ({
  PluginLoader: vi.fn(),
}));

vi.mock('../src/proxy/chain', () => ({
  default: {},
}));

vi.mock('../src/config/env', () => ({
  serverConfig: {
    GIT_PROXY_SERVER_PORT: 8001,
    GIT_PROXY_HTTPS_SERVER_PORT: 8444,
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

// Import mocked modules
import * as http from 'http';
import * as https from 'https';
import * as routes from '../src/proxy/routes';
import * as config from '../src/config';
import * as db from '../src/db';
import * as plugin from '../src/plugin';
import * as fs from 'fs';

// Import the class under test
import { Proxy } from '../src/proxy/index';

interface MockServer {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface MockRouter {
  use: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  stack: any[];
}

describe('Proxy', () => {
  let proxy: Proxy;
  let mockHttpServer: MockServer;
  let mockHttpsServer: MockServer;
  let mockRouter: MockRouter;
  let mockPluginLoader: { load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    proxy = new Proxy();

    // Setup mock servers
    mockHttpServer = {
      listen: vi.fn().mockImplementation((port: number, callback?: () => void) => {
        if (callback) setImmediate(callback);
        return mockHttpServer;
      }),
      close: vi.fn().mockImplementation((callback?: () => void) => {
        if (callback) setImmediate(callback);
        return mockHttpServer;
      }),
    };

    mockHttpsServer = {
      listen: vi.fn().mockImplementation((port: number, callback?: () => void) => {
        if (callback) setImmediate(callback);
        return mockHttpsServer;
      }),
      close: vi.fn().mockImplementation((callback?: () => void) => {
        if (callback) setImmediate(callback);
        return mockHttpsServer;
      }),
    };

    // Setup mock router - create a function that Express can use
    const routerFunction = vi.fn();
    mockRouter = Object.assign(routerFunction, {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      stack: [],
    });

    // Setup mock plugin loader
    mockPluginLoader = {
      load: vi.fn().mockResolvedValue(undefined),
    };

    // Configure mocks
    vi.mocked(http.createServer).mockReturnValue(mockHttpServer as any);
    vi.mocked(https.createServer).mockReturnValue(mockHttpsServer as any);
    vi.mocked(routes.getRouter).mockResolvedValue(mockRouter as any);
    vi.mocked(config.getTLSEnabled).mockReturnValue(false);
    vi.mocked(config.getTLSKeyPemPath).mockReturnValue(undefined);
    vi.mocked(config.getTLSCertPemPath).mockReturnValue(undefined);
    vi.mocked(config.getPlugins).mockReturnValue(['mock-plugin']);
    vi.mocked(config.getAuthorisedList).mockReturnValue([
      { project: 'test-proj', name: 'test-repo', url: 'test-url' },
    ]);
    vi.mocked(db.getRepos).mockResolvedValue([]);
    vi.mocked(db.createRepo).mockResolvedValue({
      _id: 'mock-repo-id',
      project: 'test-proj',
      name: 'test-repo',
      url: 'test-url',
      users: { canPush: [], canAuthorise: [] },
    });
    vi.mocked(db.addUserCanPush).mockResolvedValue(undefined);
    vi.mocked(db.addUserCanAuthorise).mockResolvedValue(undefined);
    vi.mocked(plugin.PluginLoader).mockReturnValue(mockPluginLoader as any);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-cert'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    proxy.stop();
  });

  afterAll(() => {
    vi.resetModules();
  });

  describe('start()', () => {
    it('should start the HTTP server', async () => {
      await proxy.start();
      const app = proxy.getExpressApp();
      expect(app).toBeTruthy();
    });

    it('should set up express app after starting', async () => {
      const proxy = new Proxy();
      expect(proxy.getExpressApp()).toBeNull();

      await proxy.start();

      expect(proxy.getExpressApp()).not.toBeNull();
      expect(proxy.getExpressApp()).toBeTypeOf('function');

      await proxy.stop();
    });
  });

  describe('getExpressApp()', () => {
    it('should return null before start() is called', () => {
      const proxy = new Proxy();

      expect(proxy.getExpressApp()).toBeNull();
    });

    it('should return express app after start() is called', async () => {
      const proxy = new Proxy();

      await proxy.start();

      const app = proxy.getExpressApp();
      expect(app).not.toBeNull();
      expect(app).toBeTypeOf('function');
      expect((app as any).use).toBeTypeOf('function');

      await proxy.stop();
    });
  });

  describe('stop()', () => {
    it('should stop without errors', async () => {
      await proxy.start();
      await expect(proxy.stop()).resolves.toBeUndefined();
    });

    it('should resolve successfully when no servers are running', async () => {
      const proxy = new Proxy();

      await proxy.stop();

      expect(mockHttpServer.close).not.toHaveBeenCalled();
      expect(mockHttpsServer.close).not.toHaveBeenCalled();
    });
  });
});
