import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { isValidGitUrl, isValidPath, isValidBranchName } from '../src/config/ConfigLoader';
import sinon from 'sinon';
import axios from 'axios';

describe('ConfigLoader', () => {
  let configLoader;
  let tempDir;
  let tempConfigFile;

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
    sinon.restore();
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

      expect(result).to.deep.equal(testConfig);
    });
  });

  describe('loadFromHttp', () => {
    it('should load configuration from HTTP endpoint', async () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
        cookieSecret: 'test-secret',
      };

      sinon.stub(axios, 'get').resolves({ data: testConfig });

      configLoader = new ConfigLoader({});
      const result = await configLoader.loadFromHttp({
        type: 'http',
        enabled: true,
        url: 'http://config-service/config',
        headers: {},
      });

      expect(result).to.deep.equal(testConfig);
    });

    it('should include bearer token if provided', async () => {
      const axiosStub = sinon.stub(axios, 'get').resolves({ data: {} });

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

      expect(
        axiosStub.calledWith('http://config-service/config', {
          headers: { Authorization: 'Bearer test-token' },
        }),
      ).to.be.true;
    });
  });

  describe('reloadConfiguration', () => {
    it('should emit configurationChanged event when config changes', async () => {
      const initialConfig = {
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
      const spy = sinon.spy();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration();

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.deep.include(newConfig);
    });

    it('should not emit event if config has not changed', async () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
      };

      const config = {
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
      const spy = sinon.spy();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration(); // First reload should emit
      await configLoader.reloadConfiguration(); // Second reload should not emit since config hasn't changed

      expect(spy.calledOnce).to.be.true; // Should only emit once
    });

    it('should not emit event if configurationSources is disabled', async () => {
      const config = {
        configurationSources: {
          enabled: false,
        },
      };

      configLoader = new ConfigLoader(config);
      const spy = sinon.spy();
      configLoader.on('configurationChanged', spy);

      await configLoader.reloadConfiguration();

      expect(spy.called).to.be.false;
    });
  });

  describe('initialize', () => {
    it('should initialize cache directory using env-paths', async () => {
      const configLoader = new ConfigLoader({});
      await configLoader.initialize();

      // Check that cacheDir is set and is a string
      expect(configLoader.cacheDir).to.be.a('string');

      // Check that it contains 'git-proxy' in the path
      expect(configLoader.cacheDir).to.include('git-proxy');

      // On macOS, it should be in the Library/Caches directory
      // On Linux, it should be in the ~/.cache directory
      // On Windows, it should be in the AppData/Local directory
      if (process.platform === 'darwin') {
        expect(configLoader.cacheDir).to.include('Library/Caches');
      } else if (process.platform === 'linux') {
        expect(configLoader.cacheDir).to.include('.cache');
      } else if (process.platform === 'win32') {
        expect(configLoader.cacheDir).to.include('AppData/Local');
      }
    });

    it('should create cache directory if it does not exist', async () => {
      const configLoader = new ConfigLoader({});
      await configLoader.initialize();

      // Check if directory exists
      expect(fs.existsSync(configLoader.cacheDir)).to.be.true;
    });
  });

  describe('start', () => {
    it('should perform initial load on start if configurationSources is enabled', async () => {
      const mockConfig = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
          reloadIntervalSeconds: 30,
        },
      };

      const configLoader = new ConfigLoader(mockConfig);
      const spy = sinon.spy(configLoader, 'reloadConfiguration');
      await configLoader.start();

      expect(spy.calledOnce).to.be.true;
    });

    it('should clear an existing reload interval if it exists', async () => {
      const mockConfig = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
        },
      };

      const configLoader = new ConfigLoader(mockConfig);
      configLoader.reloadTimer = setInterval(() => {}, 1000);
      await configLoader.start();

      expect(configLoader.reloadTimer).to.be.null;
    });

    it('should run reloadConfiguration multiple times on short reload interval', async () => {
      const mockConfig = {
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

      const configLoader = new ConfigLoader(mockConfig);
      const spy = sinon.spy(configLoader, 'reloadConfiguration');
      await configLoader.start();

      // Make sure the reload interval is triggered
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(spy.callCount).to.greaterThan(1);
    });

    it('should clear the interval when stop is called', async () => {
      const mockConfig = {
        configurationSources: {
          enabled: true,
          sources: [
            {
              type: 'file',
              enabled: true,
              path: tempConfigFile,
            },
          ],
        },
      };

      const configLoader = new ConfigLoader(mockConfig);
      configLoader.reloadTimer = setInterval(() => {}, 1000);
      expect(configLoader.reloadTimer).to.not.be.null;

      await configLoader.stop();
      expect(configLoader.reloadTimer).to.be.null;
    });
  });

  describe('loadRemoteConfig', () => {
    let configLoader;
    beforeEach(async () => {
      const configFilePath = path.join(__dirname, '..', 'proxy.config.json');
      const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

      config.configurationSources.enabled = true;
      configLoader = new ConfigLoader(config);
      await configLoader.initialize();
    });

    it('should load configuration from git repository', async function () {
      // eslint-disable-next-line no-invalid-this
      this.timeout(10000);

      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      const config = await configLoader.loadFromSource(source);

      // Verify the loaded config has expected structure
      expect(config).to.be.an('object');
      expect(config).to.have.property('proxyUrl');
      expect(config).to.have.property('cookieSecret');
    });

    it('should throw error for invalid configuration file path (git)', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: '\0', // Invalid path
        branch: 'main',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.equal('Invalid configuration file path in repository');
      }
    });

    it('should throw error for invalid configuration file path (file)', async function () {
      const source = {
        type: 'file',
        path: '\0', // Invalid path
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.equal('Invalid configuration file path');
      }
    });

    it('should load configuration from http', async function () {
      // eslint-disable-next-line no-invalid-this
      this.timeout(10000);

      const source = {
        type: 'http',
        url: 'https://raw.githubusercontent.com/finos/git-proxy/refs/heads/main/proxy.config.json',
        enabled: true,
      };

      const config = await configLoader.loadFromSource(source);

      // Verify the loaded config has expected structure
      expect(config).to.be.an('object');
      expect(config).to.have.property('proxyUrl');
      expect(config).to.have.property('cookieSecret');
    });

    it('should throw error if repository is invalid', async function () {
      const source = {
        type: 'git',
        repository: 'invalid-repository',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };
      
      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.equal('Invalid repository URL format');
      }
    });

    it('should throw error if branch name is invalid', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: '..', // invalid branch pattern
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.equal('Invalid branch name format');
      }
    });

    it('should throw error if configuration source is invalid', async function () {
      const source = {
        type: 'invalid',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.contain('Unsupported configuration source type');
      }
    });

    it('should throw error if repository is a valid URL but not a git repository', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/test-org/test-repo.git',
        path: 'proxy.config.json',
        branch: 'main',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.contain('Failed to clone repository');
      }
    });

    it('should throw error if repository is a valid git repo but the branch does not exist', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'proxy.config.json',
        branch: 'branch-does-not-exist',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.contain('Failed to checkout branch');
      }
    });

    it('should throw error if config path was not found', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'path-not-found.json',
        branch: 'main',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.contain('Configuration file not found at');
      }
    });

    it('should throw error if config file is not valid JSON', async function () {
      const source = {
        type: 'git',
        repository: 'https://github.com/finos/git-proxy.git',
        path: 'test/fixtures/baz.js',
        branch: 'main',
        enabled: true,
      };

      try {
        await configLoader.loadFromSource(source);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.contain('Failed to read or parse configuration file');
      }
    });
  });

  describe('deepMerge', () => {
    let configLoader;

    beforeEach(() => {
      configLoader = new ConfigLoader({});
    });

    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = configLoader.deepMerge(target, source);

      expect(result).to.deep.equal({ a: 1, b: 3, c: 4 });
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

      expect(result).to.deep.equal({
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

      expect(result).to.deep.equal({
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

      expect(result).to.deep.equal({
        a: null,
        b: 2,
        c: 3,
      });
    });

    it('should handle empty objects', () => {
      const target = {};
      const source = { a: 1, b: { c: 2 } };

      const result = configLoader.deepMerge(target, source);

      expect(result).to.deep.equal({ a: 1, b: { c: 2 } });
    });

    it('should not modify the original objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { c: 3 } };
      const originalTarget = { ...target };
      const originalSource = { ...source };

      configLoader.deepMerge(target, source);

      expect(target).to.deep.equal(originalTarget);
      expect(source).to.deep.equal(originalSource);
    });
  });
});

describe('Validation Helpers', () => {
  describe('isValidGitUrl', () => {
    it('should validate git URLs correctly', () => {
      // Valid URLs
      expect(isValidGitUrl('git://github.com/user/repo.git')).to.be.true;
      expect(isValidGitUrl('https://github.com/user/repo.git')).to.be.true;
      expect(isValidGitUrl('ssh://git@github.com/user/repo.git')).to.be.true;
      expect(isValidGitUrl('user@github.com:user/repo.git')).to.be.true;

      // Invalid URLs
      expect(isValidGitUrl('not-a-git-url')).to.be.false;
      expect(isValidGitUrl('http://github.com/user/repo')).to.be.false;
      expect(isValidGitUrl('')).to.be.false;
      expect(isValidGitUrl(null)).to.be.false;
      expect(isValidGitUrl(undefined)).to.be.false;
      expect(isValidGitUrl(123)).to.be.false;
    });
  });

  describe('isValidPath', () => {
    it('should validate file paths correctly', () => {
      const cwd = process.cwd();

      // Valid paths
      expect(isValidPath(path.join(cwd, 'config.json'))).to.be.true;
      expect(isValidPath(path.join(cwd, 'subfolder/config.json'))).to.be.true;
      expect(isValidPath('/etc/passwd')).to.be.true;
      expect(isValidPath('../config.json')).to.be.true;

      // Invalid paths
      expect(isValidPath('')).to.be.false;
      expect(isValidPath(null)).to.be.false;
      expect(isValidPath(undefined)).to.be.false;

      // Additional edge cases
      expect(isValidPath({})).to.be.false;
      expect(isValidPath([])).to.be.false;
      expect(isValidPath(123)).to.be.false;
      expect(isValidPath(true)).to.be.false;
      expect(isValidPath('\0invalid')).to.be.false;
      expect(isValidPath('\u0000')).to.be.false;
    });

    it('should handle path resolution errors', () => {
      // Mock path.resolve to throw an error
      const originalResolve = path.resolve;
      path.resolve = () => {
        throw new Error('Mock path resolution error');
      };

      expect(isValidPath('some/path')).to.be.false;

      // Restore original path.resolve
      path.resolve = originalResolve;
    });
  });

  describe('isValidBranchName', () => {
    it('should validate git branch names correctly', () => {
      // Valid branch names
      expect(isValidBranchName('main')).to.be.true;
      expect(isValidBranchName('feature/new-feature')).to.be.true;
      expect(isValidBranchName('release-1.0')).to.be.true;
      expect(isValidBranchName('fix_123')).to.be.true;
      expect(isValidBranchName('user/feature/branch')).to.be.true;

      // Invalid branch names
      expect(isValidBranchName('.invalid')).to.be.false;
      expect(isValidBranchName('-invalid')).to.be.false;
      expect(isValidBranchName('branch with spaces')).to.be.false;
      expect(isValidBranchName('')).to.be.false;
      expect(isValidBranchName(null)).to.be.false;
      expect(isValidBranchName(undefined)).to.be.false;
      expect(isValidBranchName('branch..name')).to.be.false;
    });
  });
});
