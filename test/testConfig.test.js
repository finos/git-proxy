const chai = require('chai');
const fs = require('fs');
const path = require('path');
const defaultSettings = require('../proxy.config.json');
const fixtures = 'fixtures';

chai.should();
const expect = chai.expect;

describe('default configuration', function () {
  it('should use default values if no user-settings.json file exists', function () {
    const config = require('../src/config');
    config.logConfiguration();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
    expect(config.getAuthorisedList()).to.be.eql(defaultSettings.authorisedList);
    expect(config.getRateLimit()).to.be.eql(defaultSettings.rateLimit);
    expect(config.getTLSKeyPemPath()).to.be.eql(defaultSettings.tls.key);
    expect(config.getTLSCertPemPath()).to.be.eql(defaultSettings.tls.cert);
    expect(config.getTLSEnabled()).to.be.eql(defaultSettings.tls.enabled);
    expect(config.getDomains()).to.be.eql(defaultSettings.domains);
    expect(config.getURLShortener()).to.be.eql(defaultSettings.urlShortener);
    expect(config.getContactEmail()).to.be.eql(defaultSettings.contactEmail);
    expect(config.getPlugins()).to.be.eql(defaultSettings.plugins);
    expect(config.getCSRFProtection()).to.be.eql(defaultSettings.csrfProtection);
    expect(config.getAttestationConfig()).to.be.eql(defaultSettings.attestationConfig);
    expect(config.getAPIs()).to.be.eql(defaultSettings.api);
  });
  after(function () {
    delete require.cache[require.resolve('../src/config')];
  });
});

describe('user configuration', function () {
  let tempDir;
  let tempUserFile;
  let oldEnv;

  beforeEach(function () {
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/config')];
    oldEnv = { ...process.env };
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    require('../src/config/file').setConfigFile(tempUserFile);
  });

  it('should override default settings for authorisedList', function () {
    const user = {
      authorisedList: [{ project: 'foo', name: 'bar', url: 'https://github.com/foo/bar.git' }],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getAuthorisedList()).to.be.eql(user.authorisedList);
    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for authentication', function () {
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

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();
    const authMethods = config.getAuthMethods();
    const oidcAuth = authMethods.find((method) => method.type === 'openidconnect');

    expect(oidcAuth).to.not.be.undefined;
    expect(oidcAuth.enabled).to.be.true;
    expect(config.getAuthMethods()).to.deep.include(user.authentication[0]);
    expect(config.getAuthMethods()).to.not.be.eql(defaultSettings.authentication);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for database', function () {
    const user = { sink: [{ type: 'postgres', enabled: true }] };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();
    const enabledMethods = defaultSettings.authentication.filter((method) => method.enabled);

    expect(config.getDatabase()).to.be.eql(user.sink[0]);
    expect(config.getDatabase()).to.not.be.eql(defaultSettings.sink[0]);
    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for SSL certificate', function () {
    const user = {
      tls: {
        enabled: true,
        key: 'my-key.pem',
        cert: 'my-cert.pem',
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
  });

  it('should override default settings for rate limiting', function () {
    const limitConfig = { rateLimit: { windowMs: 60000, limit: 1500 } };
    fs.writeFileSync(tempUserFile, JSON.stringify(limitConfig));

    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getRateLimit().windowMs).to.be.eql(limitConfig.rateLimit.windowMs);
    expect(config.getRateLimit().limit).to.be.eql(limitConfig.rateLimit.limit);
  });

  it('should override default settings for attestation config', function () {
    const user = {
      attestationConfig: {
        questions: [
          { label: 'Testing Label Change', tooltip: { text: 'Testing Tooltip Change', links: [] } },
        ],
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getAttestationConfig()).to.be.eql(user.attestationConfig);
  });

  it('should override default settings for url shortener', function () {
    const user = { urlShortener: 'https://url-shortener.com' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getURLShortener()).to.be.eql(user.urlShortener);
  });

  it('should override default settings for contact email', function () {
    const user = { contactEmail: 'test@example.com' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getContactEmail()).to.be.eql(user.contactEmail);
  });

  it('should override default settings for plugins', function () {
    const user = { plugins: ['plugin1', 'plugin2'] };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getPlugins()).to.be.eql(user.plugins);
  });

  it('should override default settings for sslCertPemPath', function () {
    const user = {
      tls: {
        enabled: true,
        key: 'my-key.pem',
        cert: 'my-cert.pem',
      },
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSEnabled()).to.be.eql(user.tls.enabled);
  });

  it('should prioritize tls.key and tls.cert over sslKeyPemPath and sslCertPemPath', function () {
    const user = {
      tls: { enabled: true, key: 'good-key.pem', cert: 'good-cert.pem' },
      sslKeyPemPath: 'bad-key.pem',
      sslCertPemPath: 'bad-cert.pem',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSEnabled()).to.be.eql(user.tls.enabled);
  });

  it('should use sslKeyPemPath and sslCertPemPath if tls.key and tls.cert are not present', function () {
    const user = { sslKeyPemPath: 'good-key.pem', sslCertPemPath: 'good-cert.pem' };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getTLSCertPemPath()).to.be.eql(user.sslCertPemPath);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.sslKeyPemPath);
    expect(config.getTLSEnabled()).to.be.eql(false);
  });

  it('should override default settings for api', function () {
    const user = { api: { gitlab: { baseUrl: 'https://gitlab.com' } } };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    // Invalidate cache to force reload
    const config = require('../src/config');
    config.invalidateCache();

    expect(config.getAPIs()).to.be.eql(user.api);
  });

  it('should override default settings for cookieSecret if env var is used', function () {
    fs.writeFileSync(tempUserFile, '{}');
    process.env.GIT_PROXY_COOKIE_SECRET = 'test-cookie-secret';

    const config = require('../src/config');
    config.invalidateCache();
    expect(config.getCookieSecret()).to.equal('test-cookie-secret');
  });

  it('should override default settings for mongo connection string if env var is used', function () {
    const user = {
      sink: [
        {
          type: 'mongo',
          enabled: true,
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));
    process.env.GIT_PROXY_MONGO_CONNECTION_STRING = 'mongodb://example.com:27017/test';

    const config = require('../src/config');
    config.invalidateCache();
    expect(config.getDatabase().connectionString).to.equal('mongodb://example.com:27017/test');
  });

  it('should test cache invalidation function', function () {
    fs.writeFileSync(tempUserFile, '{}');

    const config = require('../src/config');

    // Load config first time
    const firstLoad = config.getAuthorisedList();

    // Invalidate cache and load again
    config.invalidateCache();
    const secondLoad = config.getAuthorisedList();

    expect(firstLoad).to.deep.equal(secondLoad);
  });

  it('should test reloadConfiguration function', async function () {
    fs.writeFileSync(tempUserFile, '{}');

    const config = require('../src/config');

    // reloadConfiguration doesn't throw
    await config.reloadConfiguration();
  });

  it('should handle configuration errors during initialization', function () {
    const user = {
      invalidConfig: 'this should cause validation error',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    expect(() => config.getAuthorisedList()).to.not.throw();
  });

  it('should test all getter functions for coverage', function () {
    fs.writeFileSync(tempUserFile, '{}');

    const config = require('../src/config');

    expect(() => config.getProxyUrl()).to.not.throw();
    expect(() => config.getCookieSecret()).to.not.throw();
    expect(() => config.getSessionMaxAgeHours()).to.not.throw();
    expect(() => config.getCommitConfig()).to.not.throw();
    expect(() => config.getPrivateOrganizations()).to.not.throw();
    expect(() => config.getUIRouteAuth()).to.not.throw();
  });

  it('should test getAuthentication function returns first auth method', function () {
    const user = {
      authentication: [
        { type: 'ldap', enabled: true },
        { type: 'local', enabled: true },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');
    config.invalidateCache();

    const firstAuth = config.getAuthentication();
    expect(firstAuth).to.be.an('object');
    expect(firstAuth.type).to.equal('ldap');
  });

  afterEach(function () {
    fs.rmSync(tempUserFile);
    fs.rmdirSync(tempDir);
    process.env = oldEnv;
    delete require.cache[require.resolve('../src/config')];
  });
});

describe('validate config files', function () {
  const config = require('../src/config/file');

  it('all valid config files should pass validation', function () {
    const validConfigFiles = ['proxy.config.valid-1.json', 'proxy.config.valid-2.json'];
    for (const testConfigFile of validConfigFiles) {
      expect(config.validate(path.join(__dirname, fixtures, testConfigFile))).to.be.true;
    }
  });

  it('all invalid config files should fail validation', function () {
    const invalidConfigFiles = ['proxy.config.invalid-1.json', 'proxy.config.invalid-2.json'];
    for (const testConfigFile of invalidConfigFiles) {
      const test = function () {
        config.validate(path.join(__dirname, fixtures, testConfigFile));
      };
      expect(test).to.throw();
    }
  });

  it('should validate using default config file when no path provided', function () {
    const originalConfigFile = config.configFile;
    const mainConfigPath = path.join(__dirname, '..', 'proxy.config.json');
    config.setConfigFile(mainConfigPath);

    try {
      // default configFile
      expect(() => config.validate()).to.not.throw();
    } finally {
      // Restore original config file
      config.setConfigFile(originalConfigFile);
    }
  });

  after(function () {
    delete require.cache[require.resolve('../src/config')];
  });
});

describe('setConfigFile function', function () {
  const config = require('../src/config/file');
  let originalConfigFile;

  beforeEach(function () {
    originalConfigFile = config.configFile;
  });

  afterEach(function () {
    // Restore original config file
    config.setConfigFile(originalConfigFile);
  });

  it('should set the config file path', function () {
    const newPath = '/tmp/new-config.json';
    config.setConfigFile(newPath);
    expect(config.configFile).to.equal(newPath);
  });

  it('should allow changing config file multiple times', function () {
    const firstPath = '/tmp/first-config.json';
    const secondPath = '/tmp/second-config.json';

    config.setConfigFile(firstPath);
    expect(config.configFile).to.equal(firstPath);

    config.setConfigFile(secondPath);
    expect(config.configFile).to.equal(secondPath);
  });
});

describe('Configuration Update Handling', function () {
  let tempDir;
  let tempUserFile;
  let oldEnv;

  beforeEach(function () {
    delete require.cache[require.resolve('../src/config')];
    oldEnv = { ...process.env };
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    require('../src/config/file').configFile = tempUserFile;
  });

  it('should test ConfigLoader initialization', function () {
    const configWithSources = {
      configurationSources: {
        enabled: true,
        sources: [
          {
            type: 'file',
            enabled: true,
            path: tempUserFile,
          },
        ],
      },
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(configWithSources));

    const config = require('../src/config');
    config.invalidateCache();

    expect(() => config.getAuthorisedList()).to.not.throw();
  });

  it('should handle config loader initialization errors', function () {
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

    const consoleErrorSpy = require('sinon').spy(console, 'error');

    const config = require('../src/config');
    config.invalidateCache();

    expect(() => config.getAuthorisedList()).to.not.throw();

    consoleErrorSpy.restore();
  });

  afterEach(function () {
    if (fs.existsSync(tempUserFile)) {
      fs.rmSync(tempUserFile, { force: true });
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
    process.env = oldEnv;
    delete require.cache[require.resolve('../src/config')];
  });
});
