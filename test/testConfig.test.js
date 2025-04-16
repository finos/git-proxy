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
    const enabledMethods = defaultSettings.authentication.filter(method => method.enabled);

    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
    expect(config.getDatabase()).to.be.eql(defaultSettings.sink[0]);
    expect(config.getTempPasswordConfig()).to.be.eql(defaultSettings.tempPassword);
    expect(config.getAuthorisedList()).to.be.eql(defaultSettings.authorisedList);
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
    const enabledMethods = defaultSettings.authentication.filter(method => method.enabled);

    expect(config.getAuthorisedList()).to.be.eql(user.authorisedList);
    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
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
    const authMethods = config.getAuthMethods();
    const googleAuth = authMethods.find(method => method.type === 'google');

    expect(googleAuth).to.not.be.undefined;
    expect(googleAuth.enabled).to.be.true;
    expect(config.getAuthMethods()).to.deep.include(user.authentication[0]);
    expect(config.getAuthMethods()).to.not.be.eql(defaultSettings.authentication);
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
    const enabledMethods = defaultSettings.authentication.filter(method => method.enabled);

    expect(config.getDatabase()).to.be.eql(user.sink[0]);
    expect(config.getDatabase()).to.not.be.eql(defaultSettings.sink[0]);
    expect(config.getAuthMethods()).to.deep.equal(enabledMethods);
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
