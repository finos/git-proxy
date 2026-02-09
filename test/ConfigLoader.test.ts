import { describe, it, beforeEach, afterEach, afterAll, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getConfigFile } from '../src/config/file';
import {
  ConfigLoader,
  isValidGitUrl,
  isValidPath,
  isValidBranchName,
} from '../src/config/ConfigLoader';
import {
  Configuration,
  ConfigurationSource,
  FileSource,
  GitSource,
  HttpSource,
} from '../src/config/types';
import axios from 'axios';

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync('gitproxy-configloader-test-');
    tempConfigFile = path.join(tempDir, 'test-config.json');
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    vi.restoreAllMocks();
    configLoader?.stop();
  });

  afterAll(async () => {
    // reset config to default after all tests have run
    const configFile = getConfigFile();
    console.log(`Restoring config to defaults from file ${configFile}`);
    configLoader = new ConfigLoader({});
    await configLoader.loadFromFile({
      type: 'file',
      enabled: true,
      path: configFile,
    });
  });

  describe('loadFromFile', () => {
    it('should load configuration from file', async () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
        cookieSecret: 'test-secret',
      };
      fs.writeFileSync(tempConfigFile, JSON.stringify(testConfig));

      configLoader = new ConfigLoader({});
      const result = await configLoader.loadFromFile({
        type: 'file',
        enabled: true,
        path: tempConfigFile,
      });

      expect(result).toBeTypeOf('object');
      expect(result.proxyUrl).toBe('https://test.com');
      expect(result.cookieSecret).toBe('test-secret');
    });
  });

  describe('loadFromHttp', () => {
    it('should load configuration from HTTP endpoint', async () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
        cookieSecret: 'test-secret',
      };

      vi.spyOn(axios, 'get').mockResolvedValue({ data: testConfig });

      configLoader = new ConfigLoader({});
      const result = await configLoader.loadFromHttp({
        type: 'http',
        enabled: true,
        url: 'http://config-service/config',
        headers: {},
      });

      expect(result).toBeTypeOf('object');
      expect(result.proxyUrl).toBe('https://test.com');
      expect(result.cookieSecret).toBe('test-secret');
    });

    it('should include bearer token if provided', async () => {
      const axiosStub = vi.spyOn(axios, 'get').mockResolvedValue({ data: {} });

      configLoader = new ConfigLoader({});
      await configLoader.loadFromHttp({
        type: 'http',
        enabled: true,
        url: 'http://config-service/config',
        auth: {
          type: 'bearer',
          token: 'test-token',
        },
      });

      expect(axiosStub).toHaveBeenCalledWith('http://config-service/config', {
        headers: { Authorization: 'Bearer test-token' },
      });
    });
  });

  describe('reloadConfiguration', () => {
    it('should emit configurationChanged event when config changes', async () => {
      const initialConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      const newConfig = {
        proxyUrl: 'https://new-test.com',
      };

      fs.writeFileSync(tempConfigFile, JSON.stringify(newConfig));

      configLoader = new ConfigLoader(initialConfig);
      const spy = vi.fn();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration();

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toMatchObject(newConfig);
    });

    it('should not emit event if config has not changed', async () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
      };

      const config: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      fs.writeFileSync(tempConfigFile, JSON.stringify(testConfig));

      configLoader = new ConfigLoader(config);
      const spy = vi.fn();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration(); // First reload should emit
      await configLoader.reloadConfiguration(); // Second reload should not emit since config hasn't changed

      expect(spy).toHaveBeenCalledOnce(); // Should only emit once
    });

    it('should not emit event if configurationSources is disabled', async () => {
      const config: Configuration = {
        configurationSources: {
          enabled: false,
          sources: [],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(config);
      const spy = vi.fn();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should skip reload and log error when configuration is invalid', async () => {
      const invalidConfig = {
        proxyUrl: 'https://test.com',
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

      fs.writeFileSync(tempConfigFile, JSON.stringify(invalidConfig));

      const initialConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(initialConfig);

      const changeEventSpy = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      configLoader.on('configurationChanged', changeEventSpy);

      await configLoader.reloadConfiguration();

      expect(changeEventSpy).not.toHaveBeenCalled();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.local.block: [invalid(regex',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid configuration, skipping reload');

      consoleErrorSpy.mockRestore();
    });

    it('should successfully reload when configuration is valid', async () => {
      const validConfig = {
        proxyUrl: 'https://test.com',
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^admin.*', // Valid regex pattern
              },
            },
          },
          message: {
            block: {
              patterns: ['WIP:', 'TODO'],
            },
          },
        },
      };

      fs.writeFileSync(tempConfigFile, JSON.stringify(validConfig));

      const initialConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(initialConfig);

      const changeEventSpy = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      configLoader.on('configurationChanged', changeEventSpy);

      await configLoader.reloadConfiguration();

      expect(changeEventSpy).toHaveBeenCalledOnce();
      expect(changeEventSpy.mock.calls[0][0]).toMatchObject(validConfig);

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid regular expression'),
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith('Invalid configuration, skipping reload');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('initialize', () => {
    it('should initialize cache directory using env-paths', async () => {
      configLoader = new ConfigLoader({});
      await configLoader.initialize();

      // Check that cacheDir is set and is a string
      expect(configLoader.cacheDirPath).toBeTypeOf('string');

      // Check that it contains 'git-proxy' in the path
      expect(configLoader.cacheDirPath).toContain('git-proxy');

      // On macOS, it should be in the Library/Caches directory
      // On Linux, it should be in the ~/.cache directory
      // On Windows, it should be in the AppData/Local directory
      if (process.platform === 'darwin') {
        expect(configLoader.cacheDirPath).toContain('Library/Caches');
      } else if (process.platform === 'linux') {
        expect(configLoader.cacheDirPath).toContain('.cache');
      } else if (process.platform === 'win32') {
        // Windows uses backslash in paths, so check for path components separately
        expect(configLoader.cacheDirPath).toContain('AppData');
        expect(configLoader.cacheDirPath).toContain('Local');
      }
    });

    it('should create cache directory if it does not exist', async () => {
      configLoader = new ConfigLoader({});
      await configLoader.initialize();

      // Check if directory exists
      expect(fs.existsSync(configLoader.cacheDirPath!)).toBe(true);
    });
  });

  describe('start', () => {
    it('should perform initial load on start if configurationSources is enabled', async () => {
      const mockConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(mockConfig);
      const spy = vi.spyOn(configLoader, 'reloadConfiguration');
      await configLoader.start();

      expect(spy).toHaveBeenCalledOnce();
    });

    it('should clear an existing reload interval if it exists', async () => {
      const mockConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(mockConfig);

      // private property overridden for testing
      (configLoader as any).reloadTimer = setInterval(() => {}, 1000);
      await configLoader.start();
      expect((configLoader as any).reloadTimer).toBe(null);
    });

    it('should run reloadConfiguration multiple times on short reload interval', async () => {
      const mockConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0.01,
        },
      };

      configLoader = new ConfigLoader(mockConfig);
      const spy = vi.spyOn(configLoader, 'reloadConfiguration');
      await configLoader.start();

      // Make sure the reload interval is triggered
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(spy.mock.calls.length).toBeGreaterThan(1);
    });

    it('should clear the interval when stop is called', async () => {
      const mockConfig: Configuration = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 0,
        },
      };

      configLoader = new ConfigLoader(mockConfig);

      // private property overridden for testing
      (configLoader as any).reloadTimer = setInterval(() => {}, 1000);
      expect((configLoader as any).reloadTimer).not.toBe(null);
      await configLoader.stop();
      expect((configLoader as any).reloadTimer).toBe(null);
    });
  });

  describe('loadRemoteConfig', () => {
    beforeEach(async () => {
      const configFilePath = path.join(__dirname, '..', 'proxy.config.json');
      const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

      config.configurationSources.enabled = true;
      configLoader = new ConfigLoader(config);
      await configLoader.initialize();
    });

    it('should load configuration from git repository', async function () {
      const source: GitSource = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      const config = await configLoader.loadFromSource(source);

      // Verify the loaded config has expected structure
      expect(config).toBeTypeOf('object');
      expect(config).toHaveProperty('cookieSecret');
    }, 10000);

    it('should throw error for invalid configuration file path (git)', async () => {
      const source: GitSource = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: '\0', // Invalid path
        branch: 'main',
        enabled: true,
      };

      await expect(configLoader.loadFromSource(source)).rejects.toThrow(
        'Invalid configuration file path in repository',
      );
    });

    it('should throw error for invalid configuration file path (file)', async () => {
      const source: FileSource = {
        type: 'file',
        path: '\0', // Invalid path
        enabled: true,
      };

      await expect(configLoader.loadFromSource(source)).rejects.toThrow(
        'Invalid configuration file path',
      );
    });

    it('should load configuration from http', async function () {
      const source: HttpSource = {
        type: 'http',
        url: 'https://raw.githubusercontent.com/finos/git-proxy/refs/heads/main/proxy.config.json',
        enabled: true,
      };

      const config = await configLoader.loadFromSource(source);

      // Verify the loaded config has expected structure
      expect(config).toBeTypeOf('object');
      expect(config).toHaveProperty('cookieSecret');
    }, 10000);

    it('should throw error if repository is invalid', async () => {
      const source: GitSource = {
        type: 'git',
        repository: 'invalid-repository',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      await expect(configLoader.loadFromSource(source)).rejects.toThrow(
        'Invalid repository URL format',
      );
    });

    it('should throw error if branch name is invalid', async () => {
      const source: GitSource = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: '..', // invalid branch pattern
        enabled: true,
      };

      await expect(configLoader.loadFromSource(source)).rejects.toThrow(
        'Invalid branch name format',
      );
    });

    it('should throw error if configuration source is invalid', async () => {
      const source: ConfigurationSource = {
        type: 'invalid' as any, // invalid type
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      await expect(configLoader.loadFromSource(source)).rejects.toThrow(
        /Unsupported configuration source type/,
      );
    });

    it(
      'should throw error if repository is a valid URL but not a git repository',
      async () => {
        const source: ConfigurationSource = {
          type: 'git',
          repository: 'https://github.com/finos/made-up-test-repo.git',
          path: 'proxy.config.json',
          branch: 'main',
          enabled: true,
        };

        // Clean up cached clone of the fake repo so the test works regardless of order
        const envPaths = (await import('env-paths')).default;
        const paths = envPaths('git-proxy', { suffix: '' });
        const repoDirName = Buffer.from(source.repository)
          .toString('base64')
          .replace(/[^a-zA-Z0-9]/g, '_');
        const repoDir = path.join(paths.cache, 'git-config-cache', repoDirName);
        if (fs.existsSync(repoDir)) {
          fs.rmSync(repoDir, { recursive: true });
        }

        await expect(configLoader.loadFromSource(source)).rejects.toThrow(
          /Failed to clone repository/,
        );
      },
      { timeout: 30000 },
    );

    it(
      'should throw error if repository is a valid git repo but the branch does not exist',
      async () => {
        const source: ConfigurationSource = {
          type: 'git',
          repository: 'https://github.com/finos/git-proxy.git',
          path: 'proxy.config.json',
          branch: 'branch-does-not-exist',
          enabled: true,
        };

        await expect(configLoader.loadFromSource(source)).rejects.toThrow(
          /Failed to checkout branch/,
        );
      },
      { timeout: 30000 },
    );

    it(
      'should throw error if config path was not found',
      async () => {
        const source: ConfigurationSource = {
          type: 'git',
          repository: 'https://github.com/finos/git-proxy.git',
          path: 'path-not-found.json',
          branch: 'main',
          enabled: true,
        };

        await expect(configLoader.loadFromSource(source)).rejects.toThrow(
          /Configuration file not found at/,
        );
      },
      { timeout: 30000 },
    );

    it(
      'should throw error if config file is not valid JSON',
      async () => {
        const source: ConfigurationSource = {
          type: 'git',
          repository: 'https://github.com/finos/git-proxy.git',
          path: 'test/fixtures/baz.js',
          branch: 'main',
          enabled: true,
        };

        await expect(configLoader.loadFromSource(source)).rejects.toThrow(
          /Failed to read or parse configuration file/,
        );
      },
      { timeout: 30000 },
    );
  });

  describe('deepMerge', () => {
    let configLoader: ConfigLoader;

    beforeEach(() => {
      configLoader = new ConfigLoader({});
    });

    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = configLoader.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = {
        a: 1,
        b: { x: 1, y: 2 },
        c: { z: 3 },
      };
      const source = {
        b: { y: 4, w: 5 },
        c: { z: 6 },
      };

      const result = configLoader.deepMerge(target, source);

      expect(result).toEqual({
        a: 1,
        b: { x: 1, y: 4, w: 5 },
        c: { z: 6 },
      });
    });

    it('should handle arrays by replacing them', () => {
      const target = {
        a: [1, 2, 3],
        b: { items: [4, 5] },
      };
      const source = {
        a: [7, 8],
        b: { items: [9] },
      };

      const result = configLoader.deepMerge(target, source);

      expect(result).toEqual({
        a: [7, 8],
        b: { items: [9] },
      });
    });

    it('should handle null and undefined values', () => {
      const target = {
        a: 1,
        b: null,
        c: undefined,
      };
      const source = {
        a: null,
        b: 2,
        c: 3,
      };

      const result = configLoader.deepMerge(target, source);

      expect(result).toEqual({
        a: null,
        b: 2,
        c: 3,
      });
    });

    it('should handle empty objects', () => {
      const target = {};
      const source = { a: 1, b: { c: 2 } };

      const result = configLoader.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: { c: 2 } });
    });

    it('should not modify the original objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { c: 3 } };
      const originalTarget = { ...target };
      const originalSource = { ...source };

      configLoader.deepMerge(target, source);

      expect(target).toEqual(originalTarget);
      expect(source).toEqual(originalSource);
    });
  });
});

describe('Validation Helpers', () => {
  describe('isValidGitUrl', () => {
    it('should validate git URLs correctly', () => {
      // Valid URLs
      expect(isValidGitUrl('git://github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('https://github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('ssh://git@github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('user@github.com:user/repo.git')).toBe(true);

      // Invalid URLs
      expect(isValidGitUrl('not-a-git-url')).toBe(false);
      expect(isValidGitUrl('http://github.com/user/repo')).toBe(false);
      expect(isValidGitUrl('')).toBe(false);
      expect(isValidGitUrl(null as any)).toBe(false);
      expect(isValidGitUrl(undefined as any)).toBe(false);
      expect(isValidGitUrl(123 as any)).toBe(false);
    });
  });

  describe('isValidPath', () => {
    it('should validate file paths correctly', () => {
      const cwd = process.cwd();

      // Valid paths
      expect(isValidPath(path.join(cwd, 'config.json'))).toBe(true);
      expect(isValidPath(path.join(cwd, 'subfolder/config.json'))).toBe(true);
      expect(isValidPath('/etc/passwd')).toBe(true);
      expect(isValidPath('../config.json')).toBe(true);

      // Invalid paths
      expect(isValidPath('')).toBe(false);
      expect(isValidPath(null as any)).toBe(false);
      expect(isValidPath(undefined as any)).toBe(false);

      // Additional edge cases
      expect(isValidPath({} as any)).toBe(false);
      expect(isValidPath([] as any)).toBe(false);
      expect(isValidPath(123 as any)).toBe(false);
      expect(isValidPath(true as any)).toBe(false);
      expect(isValidPath('\0invalid')).toBe(false);
      expect(isValidPath('\u0000')).toBe(false);
    });
  });

  describe('isValidBranchName', () => {
    it('should validate git branch names correctly', () => {
      // Valid branch names
      expect(isValidBranchName('main')).toBe(true);
      expect(isValidBranchName('feature/new-feature')).toBe(true);
      expect(isValidBranchName('release-1.0')).toBe(true);
      expect(isValidBranchName('fix_123')).toBe(true);
      expect(isValidBranchName('user/feature/branch')).toBe(true);

      // Invalid branch names
      expect(isValidBranchName('.invalid')).toBe(false);
      expect(isValidBranchName('-invalid')).toBe(false);
      expect(isValidBranchName('branch with spaces')).toBe(false);
      expect(isValidBranchName('')).toBe(false);
      expect(isValidBranchName(null as any)).toBe(false);
      expect(isValidBranchName(undefined as any)).toBe(false);
      expect(isValidBranchName('branch..name')).toBe(false);
    });
  });
});

describe('ConfigLoader Error Handling', () => {
  let configLoader: ConfigLoader;
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync('gitproxy-configloader-test-');
    tempConfigFile = path.join(tempDir, 'test-config.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    vi.restoreAllMocks();
    configLoader?.stop();
  });

  it('should handle invalid JSON in file source', async () => {
    fs.writeFileSync(tempConfigFile, 'invalid json content');

    configLoader = new ConfigLoader({});
    await expect(
      configLoader.loadFromFile({
        type: 'file',
        enabled: true,
        path: tempConfigFile,
      }),
    ).rejects.toThrow(/Invalid configuration file format/);
  });

  it('should handle HTTP request errors', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));

    configLoader = new ConfigLoader({});
    await expect(
      configLoader.loadFromHttp({
        type: 'http',
        enabled: true,
        url: 'http://config-service/config',
      }),
    ).rejects.toThrow('Network error');
  });

  it('should handle invalid JSON from HTTP response', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: 'invalid json response' });

    configLoader = new ConfigLoader({});
    await expect(
      configLoader.loadFromHttp({
        type: 'http',
        enabled: true,
        url: 'http://config-service/config',
      }),
    ).rejects.toThrow(/Invalid configuration format from HTTP source/);
  });
});
