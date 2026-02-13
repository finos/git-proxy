/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import http from 'http';
import https from 'https';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import fs from 'fs';

/* 
  jescalada: these tests are currently causing the following error
  when running tests in the CI or for the first time locally:
  Error: listen EADDRINUSE: address already in use :::8000

  This is likely due to improper test isolation or cleanup in another test file
  especially related to proxy.start() and proxy.stop() calls

  Related: skipped tests in testProxyRoute.test.ts - these have a race condition
  where either these or those tests fail depending on execution order
  TODO: Find root cause of this error and fix it 
  https://github.com/finos/git-proxy/issues/1294
*/
describe('Proxy Module TLS Certificate Loading', () => {
  let proxyModule: any;
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
      const actual: any = await importOriginal();
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
      const actual: any = await importOriginal();
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
    } catch (err) {
      console.error('Error occurred when stopping the proxy: ', err);
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
