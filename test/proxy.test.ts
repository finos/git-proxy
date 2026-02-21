import http from 'http';
import https from 'https';
import { describe, it, beforeEach, afterEach, expect, vi, Mock } from 'vitest';
import fs from 'fs';
import { GitProxyConfig } from '../src/config/generated/config';
import { Proxy } from '../src/proxy';
import { handleAndLogError } from '../src/utils/errors';

describe('Proxy Module TLS Certificate Loading', () => {
  let proxyModule: Proxy;
  let mockConfig: any;
  let mockHttpServer: any;
  let mockHttpsServer: any;

  beforeEach(async () => {
    vi.resetModules();

    mockConfig = {
      getCommitConfig: vi.fn(),
      getTLSEnabled: vi.fn(),
      getTLSKeyPemPath: vi.fn(),
      getTLSCertPemPath: vi.fn(),
      getPlugins: vi.fn().mockReturnValue([]),
      getAuthorisedList: vi.fn().mockReturnValue([]),
    };

    const mockDb = {
      getRepos: vi.fn().mockResolvedValue([]),
      createRepo: vi.fn().mockResolvedValue(undefined),
      addUserCanPush: vi.fn().mockResolvedValue(undefined),
      addUserCanAuthorise: vi.fn().mockResolvedValue(undefined),
    };

    const mockPluginLoader = {
      load: vi.fn().mockResolvedValue(undefined),
    };

    mockHttpServer = {
      listen: vi.fn().mockImplementation((_port, cb) => {
        if (cb) cb();
        return mockHttpServer;
      }),
      close: vi.fn().mockImplementation((cb) => {
        if (cb) cb();
      }),
      on: vi.fn().mockReturnThis(),
    };

    mockHttpsServer = {
      listen: vi.fn().mockImplementation((_port, cb) => {
        if (cb) cb();
        return mockHttpsServer;
      }),
      close: vi.fn().mockImplementation((cb) => {
        if (cb) cb();
      }),
      on: vi.fn().mockReturnThis(),
    };

    vi.doMock('../src/plugin', () => {
      return {
        PluginLoader: vi.fn(() => mockPluginLoader),
      };
    });

    vi.doMock('../src/config', async (importOriginal) => {
      const actual = await importOriginal<GitProxyConfig>();
      return {
        ...actual,
        getTLSEnabled: mockConfig.getTLSEnabled,
        getTLSKeyPemPath: mockConfig.getTLSKeyPemPath,
        getTLSCertPemPath: mockConfig.getTLSCertPemPath,
        getPlugins: mockConfig.getPlugins,
        getAuthorisedList: mockConfig.getAuthorisedList,
      };
    });

    vi.doMock('../src/db', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        getRepos: mockDb.getRepos,
        createRepo: mockDb.createRepo,
        addUserCanPush: mockDb.addUserCanPush,
        addUserCanAuthorise: mockDb.addUserCanAuthorise,
        getAllProxiedHosts: vi.fn().mockResolvedValue([]),
      };
    });

    vi.doMock('../src/proxy/chain', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/proxy/chain')>();
      return {
        ...actual,
        chainPluginLoader: null,
      };
    });

    vi.spyOn(http, 'createServer').mockReturnValue(mockHttpServer);

    vi.spyOn(https, 'createServer').mockReturnValue(mockHttpsServer);

    const ProxyClass = (await import('../src/proxy/index')).Proxy;
    proxyModule = new ProxyClass();
  });

  afterEach(async () => {
    try {
      await proxyModule.stop();
    } catch (error: unknown) {
      handleAndLogError(error, 'Error occurred when stopping the proxy');
    }
    vi.restoreAllMocks();
  });

  describe('TLS certificate file reading', () => {
    it('should read TLS key and cert files when TLS is enabled and paths are provided', async () => {
      const mockKeyContent = Buffer.from('mock-key-content');
      const mockCertContent = Buffer.from('mock-cert-content');

      mockConfig.getTLSEnabled.mockReturnValue(true);
      mockConfig.getTLSKeyPemPath.mockReturnValue('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.mockReturnValue('/path/to/cert.pem');

      const fsStub = vi.spyOn(fs, 'readFileSync');
      fsStub.mockReturnValue(Buffer.from('default-cert'));
      fsStub.mockImplementation((path: any) => {
        if (path === '/path/to/key.pem') return mockKeyContent;
        if (path === '/path/to/cert.pem') return mockCertContent;
        return Buffer.from('default-cert');
      });

      await proxyModule.start();

      expect(fsStub).toHaveBeenCalledWith('/path/to/key.pem');
      expect(fsStub).toHaveBeenCalledWith('/path/to/cert.pem');
    });

    it('should not read TLS files when TLS is disabled', async () => {
      mockConfig.getTLSEnabled.mockReturnValue(false);
      mockConfig.getTLSKeyPemPath.mockReturnValue('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.mockReturnValue('/path/to/cert.pem');

      const fsStub = vi.spyOn(fs, 'readFileSync');

      await proxyModule.start();

      expect(fsStub).not.toHaveBeenCalled();
    });

    it('should not read TLS files when paths are not provided', async () => {
      mockConfig.getTLSEnabled.mockReturnValue(true);
      mockConfig.getTLSKeyPemPath.mockReturnValue(null);
      mockConfig.getTLSCertPemPath.mockReturnValue(null);

      const fsStub = vi.spyOn(fs, 'readFileSync');

      await proxyModule.start();

      expect(fsStub).not.toHaveBeenCalled();
    });
  });
});
