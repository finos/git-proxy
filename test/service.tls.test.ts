import http from 'http';
import https from 'https';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import fs from 'fs';

describe('Service Module TLS', () => {
  let serviceModule: any;
  let mockConfig: any;
  let mockHttpServer: any;
  let mockHttpsServer: any;
  let mockProxy: any;

  beforeEach(async () => {
    vi.resetModules();

    mockConfig = {
      getTLSEnabled: vi.fn(),
      getTLSKeyPemPath: vi.fn(),
      getTLSCertPemPath: vi.fn(),
      getRateLimit: vi.fn().mockReturnValue({ windowMs: 15 * 60 * 1000, max: 100 }),
      getCookieSecret: vi.fn().mockReturnValue('test-secret'),
      getSessionMaxAgeHours: vi.fn().mockReturnValue(12),
      getCSRFProtection: vi.fn().mockReturnValue(false),
    };

    mockHttpServer = {
      listen: vi.fn().mockReturnThis(),
      close: vi.fn().mockImplementation((cb) => {
        if (cb) cb();
      }),
      on: vi.fn().mockReturnThis(),
    };

    mockHttpsServer = {
      listen: vi.fn().mockImplementation((_port: any, cb: any) => {
        if (cb) cb();
        return mockHttpsServer;
      }),
      close: vi.fn().mockImplementation((cb: any) => {
        if (cb) cb();
      }),
      on: vi.fn().mockReturnThis(),
    };

    mockProxy = {};

    vi.doMock('../src/config', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        getTLSEnabled: mockConfig.getTLSEnabled,
        getTLSKeyPemPath: mockConfig.getTLSKeyPemPath,
        getTLSCertPemPath: mockConfig.getTLSCertPemPath,
        getRateLimit: mockConfig.getRateLimit,
        getCookieSecret: mockConfig.getCookieSecret,
        getSessionMaxAgeHours: mockConfig.getSessionMaxAgeHours,
        getCSRFProtection: mockConfig.getCSRFProtection,
      };
    });

    vi.doMock('../src/db', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        getSessionStore: vi.fn().mockReturnValue(undefined),
      };
    });

    vi.doMock('../src/service/passport', () => ({
      configure: vi.fn().mockResolvedValue({
        initialize: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
        session: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
      }),
    }));

    vi.doMock('../src/service/routes', () => ({
      default: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
    }));

    vi.spyOn(http, 'createServer').mockReturnValue(mockHttpServer as any);
    vi.spyOn(https, 'createServer').mockReturnValue(mockHttpsServer as any);

    serviceModule = await import('../src/service/index');
  });

  afterEach(async () => {
    try {
      await serviceModule.Service.stop();
    } catch (err) {
      console.error('Error occurred when stopping the service: ', err);
    }
    vi.restoreAllMocks();
  });

  describe('TLS certificate file reading', () => {
    it('should start HTTPS server and read TLS files when TLS is enabled and paths are provided', async () => {
      const mockKeyContent = Buffer.from('mock-key-content');
      const mockCertContent = Buffer.from('mock-cert-content');

      mockConfig.getTLSEnabled.mockReturnValue(true);
      mockConfig.getTLSKeyPemPath.mockReturnValue('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.mockReturnValue('/path/to/cert.pem');

      const fsStub = vi.spyOn(fs, 'readFileSync');
      fsStub.mockImplementation((path: any) => {
        if (path === '/path/to/key.pem') return mockKeyContent;
        if (path === '/path/to/cert.pem') return mockCertContent;
        return Buffer.from('default');
      });

      await serviceModule.Service.start(mockProxy);

      expect(https.createServer).toHaveBeenCalled();
      expect(fsStub).toHaveBeenCalledWith('/path/to/key.pem');
      expect(fsStub).toHaveBeenCalledWith('/path/to/cert.pem');
    });

    it('should not start HTTPS server when TLS is disabled', async () => {
      mockConfig.getTLSEnabled.mockReturnValue(false);

      await serviceModule.Service.start(mockProxy);

      expect(https.createServer).not.toHaveBeenCalled();
    });

    it('should not read TLS files when paths are not provided', async () => {
      mockConfig.getTLSEnabled.mockReturnValue(true);
      mockConfig.getTLSKeyPemPath.mockReturnValue(null);
      mockConfig.getTLSCertPemPath.mockReturnValue(null);

      const fsStub = vi.spyOn(fs, 'readFileSync');

      await serviceModule.Service.start(mockProxy);

      expect(fsStub).not.toHaveBeenCalled();
    });

    it('should close both HTTP and HTTPS servers on stop() when TLS is enabled', async () => {
      mockConfig.getTLSEnabled.mockReturnValue(true);
      mockConfig.getTLSKeyPemPath.mockReturnValue('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.mockReturnValue('/path/to/cert.pem');

      vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('mock-content'));

      await serviceModule.Service.start(mockProxy);
      await serviceModule.Service.stop();

      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(mockHttpsServer.close).toHaveBeenCalled();
    });
  });
});
