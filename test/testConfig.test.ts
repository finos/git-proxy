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

import { describe, it, expect, beforeEach, afterEach, vi, MockInstance } from 'vitest';
import fs from 'fs';
import path from 'path';
import defaultSettings from '../proxy.config.json';

import * as configFile from '../src/config/file';

const fixtures = 'fixtures';

describe('default configuration', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('should use default values if no user-settings.json file exists', async () => {
    const config = await import('../src/config');
    config.logConfiguration();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getAuthMethods()).toEqual(enabledMethods);
    expect(config.getDatabase()).toEqual(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).toEqual(defaultSettings.tempPassword);
    expect(config.getProxyUrl()).toBeUndefined();
    expect(config.getAuthorisedList()).toEqual(defaultSettings.authorisedList);
    expect(config.getRateLimit()).toEqual(defaultSettings.rateLimit);
    expect(config.getTLSKeyPemPath()).toEqual(defaultSettings.tls.key);
    expect(config.getTLSCertPemPath()).toEqual(defaultSettings.tls.cert);
    expect(config.getTLSEnabled()).toEqual(defaultSettings.tls.enabled);
    expect(config.getDomains()).toEqual(defaultSettings.domains);
    expect(config.getURLShortener()).toEqual(defaultSettings.urlShortener);
    expect(config.getContactEmail()).toEqual(defaultSettings.contactEmail);
    expect(config.getPlugins()).toEqual(defaultSettings.plugins);
    expect(config.getCSRFProtection()).toEqual(defaultSettings.csrfProtection);
    expect(config.getSessionMaxAgeHours()).toEqual(defaultSettings.sessionMaxAgeHours);
    expect(config.getCommitConfig()).toEqual(defaultSettings.commitConfig);
    expect(config.getAttestationConfig()).toEqual(defaultSettings.attestationConfig);
    expect(config.getAPIs()).toEqual(defaultSettings.api);
    expect(config.getAPIAuthMethods()).toEqual(
      defaultSettings.apiAuthentication.filter((method) => method.enabled),
    );
    expect(config.getPrivateOrganizations()).toEqual(defaultSettings.privateOrganizations);
    expect(config.getUIRouteAuth()).toEqual(defaultSettings.uiRouteAuth);
  });
});

describe('user configuration', () => {
  let tempDir: string;
  let tempUserFile: string;
  let oldEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    vi.resetModules();
    oldEnv = { ...process.env };
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    const fileModule = await import('../src/config/file');
    fileModule.setConfigFile(tempUserFile);
  });

  afterEach(() => {
    if (fs.existsSync(tempUserFile)) {
      fs.rmSync(tempUserFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
    process.env = { ...oldEnv };
    vi.resetModules();
  });

  it('should override default settings for authorisedList', async () => {
    const user = {
      authorisedList: [{ project: 'foo', name: 'bar', url: 'https://github.com/foo/bar.git' }],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getAuthorisedList()).toEqual(user.authorisedList);
    expect(config.getAuthMethods()).toEqual(enabledMethods);
    expect(config.getDatabase()).toEqual(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).toEqual(defaultSettings.tempPassword);
  });

  it('should override default settings for authentication', async () => {
    const user = {
      authentication: [
        {
          type: 'openidconnect',
          enabled: true,
          oidcConfig: {
            issuer: 'https://accounts.google.com',
            clientID: 'test-client-id',
            clientSecret: 'test-client-secret',
            callbackURL: 'https://example.com/callback',
            scope: 'openid email profile',
          },
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();
    const authMethods = config.getAuthMethods();
    const oidcAuth = authMethods.find((method) => method.type === 'openidconnect');

    expect(oidcAuth).toBeDefined();
    expect(oidcAuth?.enabled).toBe(true);
    expect(config.getAuthMethods()).toContainEqual(user.authentication[0]);
    expect(config.getAuthMethods()).not.toEqual(defaultSettings.authentication);
    expect(config.getDatabase()).toEqual(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).toEqual(defaultSettings.tempPassword);
  });

  it('should override default settings for database', async () => {
    const user = { sink: [{ type: 'postgres', enabled: true }] };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getDatabase()).toEqual(user.sink[0]);
    expect(config.getDatabase()).not.toEqual(defaultSettings.sink[0]);
    expect(config.getAuthMethods()).toEqual(enabledMethods);
    expect(config.getTempPasswordConfig()).toEqual(defaultSettings.tempPassword);
  });

  it('should override default settings for SSL certificate', async () => {
    const user = {
      tls: {
        enabled: true,
        key: 'my-key.pem',
        cert: 'my-cert.pem',
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getTLSKeyPemPath()).toEqual(user.tls.key);
    expect(config.getTLSCertPemPath()).toEqual(user.tls.cert);
  });

  it('should override default settings for rate limiting', async () => {
    const limitConfig = { rateLimit: { windowMs: 60000, limit: 1500 } };
    fs.writeFileSync(tempUserFile, JSON.stringify(limitConfig));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getRateLimit()?.windowMs).toBe(limitConfig.rateLimit.windowMs);
    expect(config.getRateLimit()?.limit).toBe(limitConfig.rateLimit.limit);
  });

  it('should override default settings for attestation config', async () => {
    const user = {
      attestationConfig: {
        questions: [
          { label: 'Testing Label Change', tooltip: { text: 'Testing Tooltip Change', links: [] } },
        ],
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getAttestationConfig()).toEqual(user.attestationConfig);
  });

  it('should override default settings for url shortener', async () => {
    const user = { urlShortener: 'https://url-shortener.com' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getURLShortener()).toBe(user.urlShortener);
  });

  it('should override default settings for contact email', async () => {
    const user = { contactEmail: 'test@example.com' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getContactEmail()).toBe(user.contactEmail);
  });

  it('should override default settings for plugins', async () => {
    const user = { plugins: ['plugin1', 'plugin2'] };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getPlugins()).toEqual(user.plugins);
  });

  it('should override default settings for sslCertPemPath', async () => {
    const user = { tls: { enabled: true, key: 'my-key.pem', cert: 'my-cert.pem' } };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).toBe(user.tls.cert);
    expect(config.getTLSKeyPemPath()).toBe(user.tls.key);
    expect(config.getTLSEnabled()).toBe(user.tls.enabled);
  });

  it('should prioritize tls.key and tls.cert over sslKeyPemPath and sslCertPemPath', async () => {
    const user = {
      tls: { enabled: true, key: 'good-key.pem', cert: 'good-cert.pem' },
      sslKeyPemPath: 'bad-key.pem',
      sslCertPemPath: 'bad-cert.pem',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).toBe(user.tls.cert);
    expect(config.getTLSKeyPemPath()).toBe(user.tls.key);
    expect(config.getTLSEnabled()).toBe(user.tls.enabled);
  });

  it('should use sslKeyPemPath and sslCertPemPath if tls.key and tls.cert are not present', async () => {
    const user = { sslKeyPemPath: 'good-key.pem', sslCertPemPath: 'good-cert.pem' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).toBe(user.sslCertPemPath);
    expect(config.getTLSKeyPemPath()).toBe(user.sslKeyPemPath);
    expect(config.getTLSEnabled()).toBe(false);
  });

  it('should override default settings for api', async () => {
    const user = { api: { gitlab: { baseUrl: 'https://gitlab.com' } } };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getAPIs()).toEqual(user.api);
  });

  it('should keep default top-level config values when user config only overrides one entry', async () => {
    const user = {
      sessionMaxAgeHours: 6,
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getSessionMaxAgeHours()).toBe(user.sessionMaxAgeHours);
    expect(config.getCommitConfig()).toEqual(defaultSettings.commitConfig);
    expect(config.getAttestationConfig()).toEqual(defaultSettings.attestationConfig);
    expect(config.getPrivateOrganizations()).toEqual(defaultSettings.privateOrganizations);
    expect(config.getUIRouteAuth()).toEqual(defaultSettings.uiRouteAuth);
  });

  it('should override default settings for cookieSecret if env var is used', async () => {
    fs.writeFileSync(tempUserFile, '{}');
    process.env.GIT_PROXY_COOKIE_SECRET = 'test-cookie-secret';

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getCookieSecret()).toBe('test-cookie-secret');
  });

  it('should override default settings for mongo connection string if env var is used', async () => {
    const user = { sink: [{ type: 'mongo', enabled: true }] };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));
    process.env.GIT_PROXY_MONGO_CONNECTION_STRING = 'mongodb://example.com:27017/test';

    const config = await import('../src/config');
    config.invalidateCache();

    expect(config.getDatabase().connectionString).toBe('mongodb://example.com:27017/test');
  });

  it('should test cache invalidation function', async () => {
    fs.writeFileSync(tempUserFile, '{}');

    const config = await import('../src/config');

    const firstLoad = config.getAuthorisedList();
    config.invalidateCache();
    const secondLoad = config.getAuthorisedList();

    expect(firstLoad).toEqual(secondLoad);
  });

  it('should test reloadConfiguration function', async () => {
    fs.writeFileSync(tempUserFile, '{}');

    const config = await import('../src/config');
    await expect(config.reloadConfiguration()).resolves.not.toThrow();
  });

  it('should handle configuration errors during initialization', async () => {
    const user = { invalidConfig: 'this should cause validation error' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    expect(() => config.getAuthorisedList()).not.toThrow();
  });

  it('should test all getter functions for coverage', async () => {
    fs.writeFileSync(tempUserFile, '{}');

    const config = await import('../src/config');

    expect(() => config.getProxyUrl()).not.toThrow();
    expect(() => config.getCookieSecret()).not.toThrow();
    expect(() => config.getSessionMaxAgeHours()).not.toThrow();
    expect(() => config.getCommitConfig()).not.toThrow();
    expect(() => config.getPrivateOrganizations()).not.toThrow();
    expect(() => config.getUIRouteAuth()).not.toThrow();
  });

  it('should test getAuthentication function returns first auth method', async () => {
    const user = {
      authentication: [
        { type: 'ldap', enabled: true },
        { type: 'local', enabled: true },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = await import('../src/config');
    config.invalidateCache();

    const firstAuth = config.getAuthentication();
    expect(firstAuth).toBeInstanceOf(Object);
    expect(firstAuth.type).toBe('ldap');
  });
});

describe('validate config files', () => {
  it('all valid config files should pass validation', () => {
    const validConfigFiles = ['proxy.config.valid-1.json', 'proxy.config.valid-2.json'];
    for (const testConfigFile of validConfigFiles) {
      expect(configFile.validate(path.join(__dirname, fixtures, testConfigFile))).toBe(true);
    }
  });

  it('all invalid config files should fail validation', () => {
    const invalidConfigFiles = ['proxy.config.invalid-1.json', 'proxy.config.invalid-2.json'];
    for (const testConfigFile of invalidConfigFiles) {
      expect(() => configFile.validate(path.join(__dirname, fixtures, testConfigFile))).toThrow();
    }
  });

  it('should validate using default config file when no path provided', () => {
    const originalConfigFile = configFile.getConfigFile();
    const mainConfigPath = path.join(__dirname, '..', 'proxy.config.json');
    configFile.setConfigFile(mainConfigPath);

    try {
      expect(() => configFile.validate()).not.toThrow();
    } finally {
      configFile.setConfigFile(originalConfigFile);
    }
  });
});

describe('setConfigFile function', () => {
  let originalConfigFile: string | undefined;

  beforeEach(() => {
    originalConfigFile = configFile.getConfigFile();
  });

  afterEach(() => {
    configFile.setConfigFile(originalConfigFile!);
  });

  it('should set the config file path', () => {
    const newPath = '/tmp/new-config.json';
    configFile.setConfigFile(newPath);
    expect(configFile.getConfigFile()).toBe(newPath);
  });

  it('should allow changing config file multiple times', () => {
    const firstPath = '/tmp/first-config.json';
    const secondPath = '/tmp/second-config.json';

    configFile.setConfigFile(firstPath);
    expect(configFile.getConfigFile()).toBe(firstPath);

    configFile.setConfigFile(secondPath);
    expect(configFile.getConfigFile()).toBe(secondPath);
  });
});

describe('Configuration Update Handling', () => {
  let tempDir: string;
  let tempUserFile: string;
  let oldEnv: NodeJS.ProcessEnv;

  const waitForMockCall = async (mock: MockInstance, callCount = 1) => {
    for (let i = 0; i < 20; i += 1) {
      if (mock.mock.calls.length >= callCount) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  beforeEach(() => {
    oldEnv = { ...process.env };
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    process.env.CONFIG_FILE = tempUserFile;
    configFile.setConfigFile(tempUserFile);
  });

  it('should test ConfigLoader initialization', async () => {
    const configWithSources = {
      ...defaultSettings,
      configurationSources: {
        enabled: true,
        sources: [],
      },
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(configWithSources));

    const config = await import('../src/config');
    config.invalidateCache();

    expect(() => config.getAuthorisedList()).not.toThrow();
  });

  it('should handle config loader initialization errors', async () => {
    const invalidConfigSources = {
      configurationSources: {
        enabled: true,
        sources: [
          {
            type: 'invalid-type',
            enabled: true,
            path: tempUserFile,
          },
        ],
      },
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(invalidConfigSources));

    const consoleErrorSpy = vi.spyOn(console, 'error');

    const config = await import('../src/config');
    config.invalidateCache();

    expect(() => config.getAuthorisedList()).not.toThrow();

    consoleErrorSpy.mockRestore();
  });

  it('should apply valid configuration updates from external sources', async () => {
    const updatedConfigFile = path.join(tempDir, 'updated-settings.json');
    const proxyStop = vi.fn().mockResolvedValue(undefined);
    const proxyStart = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../src/proxy', () => ({
      stop: proxyStop,
      start: proxyStart,
    }));

    const configWithSources = {
      configurationSources: {
        enabled: true,
        sources: [
          {
            type: 'file',
            enabled: true,
            path: updatedConfigFile,
          },
        ],
      },
    };
    const updatedConfig = {
      ...defaultSettings,
      configurationSources: configWithSources.configurationSources,
      sessionMaxAgeHours: 8,
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(configWithSources));
    fs.writeFileSync(updatedConfigFile, JSON.stringify(updatedConfig));

    const config = await import('../src/config');

    await waitForMockCall(proxyStart);

    expect(proxyStop).toHaveBeenCalledTimes(1);
    expect(proxyStart).toHaveBeenCalledTimes(1);
    expect(config.getSessionMaxAgeHours()).toBe(updatedConfig.sessionMaxAgeHours);
  });

  it('should restart the proxy with the previous config when updates fail', async () => {
    const updatedConfigFile = path.join(tempDir, 'updated-settings.json');
    const proxyStop = vi.fn().mockRejectedValue(new Error('stop failed'));
    const proxyStart = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../src/proxy', () => ({
      stop: proxyStop,
      start: proxyStart,
    }));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const configWithSources = {
      configurationSources: {
        enabled: true,
        sources: [
          {
            type: 'file',
            enabled: true,
            path: updatedConfigFile,
          },
        ],
      },
    };
    const updatedConfig = {
      ...defaultSettings,
      configurationSources: configWithSources.configurationSources,
      sessionMaxAgeHours: 8,
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(configWithSources));
    fs.writeFileSync(updatedConfigFile, JSON.stringify(updatedConfig));

    try {
      await import('../src/config');

      await waitForMockCall(proxyStart);

      expect(proxyStop).toHaveBeenCalledTimes(1);
      expect(proxyStart).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to apply new configuration: stop failed',
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.env = oldEnv;

    vi.doUnmock('../src/proxy');
    vi.resetModules();
  });
});

describe('loadFullConfiguration', () => {
  let tempDir: string;
  let tempUserFile: string;
  let oldEnv: NodeJS.ProcessEnv;
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeEach(async () => {
    vi.resetModules();
    oldEnv = { ...process.env };
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fileModule = await import('../src/config/file');
    fileModule.setConfigFile(tempUserFile);
  });

  afterEach(() => {
    if (fs.existsSync(tempUserFile)) {
      fs.rmSync(tempUserFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
    process.env = { ...oldEnv };
    consoleErrorSpy.mockRestore();
    vi.resetModules();
  });

  describe('validation', () => {
    it('should load successfully when user config contains valid regex patterns', async () => {
      const validUser = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^admin.*',
              },
              domain: {
                allow: '.*@example\\.com$',
              },
            },
          },
          message: {
            block: {
              patterns: ['^WIP:', 'TODO', '[Tt]est'],
            },
          },
          diff: {
            block: {
              patterns: ['password', 'secret.*key'],
            },
          },
        },
      };
      fs.writeFileSync(tempUserFile, JSON.stringify(validUser));

      const config = await import('../src/config');
      config.invalidateCache();

      expect(() => {
        config.reloadConfiguration(); // Calls loadFullConfiguration
      }).not.toThrow();

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid regular expression'),
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'Invalid configuration: Please check your configuration file and restart GitProxy.',
      );
    });

    it('should throw error when config file has invalid commitConfig entry', async () => {
      const invalidConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '[invalid(regex',
              },
            },
          },
        },
      };

      fs.writeFileSync(tempUserFile, JSON.stringify(invalidConfig));

      // Needed since loadFullConfiguration is executed on import too
      await expect(import('../src/config')).rejects.toThrow(
        'Invalid configuration: Please check your configuration file and restart GitProxy.',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.local.block: [invalid(regex',
      );
    });

    it('should throw error when merged defaults miss required top-level values', async () => {
      const config = await import('../src/config');
      const settingsWithoutSink = { ...defaultSettings, sink: undefined };

      expect(() => config.assertHasRequiredTopLevelConfig(settingsWithoutSink)).toThrow(
        'Missing required top-level configuration values: sink',
      );
    });
  });
});
