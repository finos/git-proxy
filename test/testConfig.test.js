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

    expect(config.getAuthentication()).to.be.eql(defaultSettings.authentication[0]);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
    expect(config.getAuthorisedList()).to.be.eql(defaultSettings.authorisedList);
    expect(config.getRateLimit()).to.be.eql(defaultSettings.rateLimit);
    expect(config.getTLSKeyPemPath()).to.be.eql(defaultSettings.tls.key);
    expect(config.getTLSCertPemPath()).to.be.eql(defaultSettings.tls.cert);
  });
  after(function () {
    delete require.cache[require.resolve('../src/config')];
  });
});

describe('user configuration', function () {
  let tempDir;
  let tempUserFile;

  beforeEach(function () {
    tempDir = fs.mkdtempSync('gitproxy-test');
    tempUserFile = path.join(tempDir, 'test-settings.json');
    require('../src/config/file').configFile = tempUserFile;
  });

  it('should override default settings for authorisedList', function () {
    const user = {
      authorisedList: [
        {
          project: 'foo',
          name: 'bar',
          url: 'https://github.com/foo/bar.git',
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getAuthorisedList()).to.be.eql(user.authorisedList);
    expect(config.getAuthentication()).to.be.eql(defaultSettings.authentication[0]);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for authentication', function () {
    const user = {
      authentication: [
        {
          type: 'google',
          enabled: true,
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getAuthentication()).to.be.eql(user.authentication[0]);
    expect(config.getAuthentication()).to.not.be.eql(defaultSettings.authentication[0]);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for database', function () {
    const user = {
      sink: [
        {
          type: 'postgres',
          enabled: true,
        },
      ],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getDatabase()).to.be.eql(user.sink[0]);
    expect(config.getDatabase()).to.not.be.eql(defaultSettings.sink[0]);
    expect(config.getAuthentication()).to.be.eql(defaultSettings.authentication[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
  });

  it('should override default settings for SSL certificate', function () {
    const user = {
      tls: {
        key: 'my-key.pem',
        cert: 'my-cert.pem',
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
  });

  it('should override default settings for rate limiting', function () {
    const limitConfig = {
      rateLimit: {
        windowMs: 60000,
        limit: 1500,
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(limitConfig));

    const config = require('../src/config');

    expect(config.getRateLimit().windowMs).to.be.eql(limitConfig.rateLimit.windowMs);
    expect(config.getRateLimit().limit).to.be.eql(limitConfig.rateLimit.limit);
  });

  it('should override default settings for attestation config', function () {
    const user = {
      attestationConfig: {
        questions: [
          {
            label: 'Testing Label Change',
            tooltip: {
              text: 'Testing Tooltip Change',
              links: [],
            },
          },
        ],
      },
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getAttestationConfig()).to.be.eql(user.attestationConfig);
  });

  it('should override default settings for url shortener', function () {
    const user = {
      urlShortener: 'https://url-shortener.com',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getURLShortener()).to.be.eql(user.urlShortener);
  });

  it('should override default settings for contact email', function () {
    const user = {
      contactEmail: 'test@example.com',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getContactEmail()).to.be.eql(user.contactEmail);
  });

  it('should override default settings for plugins', function () {
    const user = {
      plugins: ['plugin1', 'plugin2'],
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getPlugins()).to.be.eql(user.plugins);
  });

  it('should override default settings for sslCertPemPath', function () {
    const user = {
      tls: {
        enabled: true,
        key: 'my-key.pem',
        cert: 'my-cert.pem',
      }
    };

    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSEnabled()).to.be.eql(user.tls.enabled);
  });

  it('should prioritize tls.key and tls.cert over sslKeyPemPath and sslCertPemPath', function () {
    const user = {
      tls: {
        enabled: true,
        key: 'good-key.pem',
        cert: 'good-cert.pem',
      },
      sslKeyPemPath: 'bad-key.pem',
      sslCertPemPath: 'bad-cert.pem',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));
    
    const config = require('../src/config');

    expect(config.getTLSCertPemPath()).to.be.eql(user.tls.cert);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.tls.key);
    expect(config.getTLSEnabled()).to.be.eql(user.tls.enabled);
  });

  it('should use sslKeyPemPath and sslCertPemPath if tls.key and tls.cert are not present', function () {
    const user = {
      sslKeyPemPath: 'good-key.pem',
      sslCertPemPath: 'good-cert.pem',
    };
    fs.writeFileSync(tempUserFile, JSON.stringify(user));

    const config = require('../src/config');

    expect(config.getTLSCertPemPath()).to.be.eql(user.sslCertPemPath);
    expect(config.getTLSKeyPemPath()).to.be.eql(user.sslKeyPemPath);
    expect(config.getTLSEnabled()).to.be.eql(false);
  });

  afterEach(function () {
    fs.rmSync(tempUserFile);
    fs.rmdirSync(tempDir);
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

  after(function () {
    delete require.cache[require.resolve('../src/config')];
  });
});
