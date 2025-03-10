const chai = require('chai');
const fs = require('fs');
const path = require('path');
const { expect } = chai;
const ConfigLoader = require('../src/config/ConfigLoader');
const sinon = require('sinon');
const axios = require('axios');

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
      const result = await configLoader.loadFromFile({ path: tempConfigFile });

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
        url: 'http://config-service/config',
        headers: {},
      });

      expect(result).to.deep.equal(testConfig);
    });

    it('should include bearer token if provided', async () => {
      const axiosStub = sinon.stub(axios, 'get').resolves({ data: {} });

      configLoader = new ConfigLoader({});
      await configLoader.loadFromHttp({
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
  });
});
