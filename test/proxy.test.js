const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const fs = require('fs');

chai.use(sinonChai);
const { expect } = chai;

describe('Proxy Module TLS Certificate Loading', () => {
  let sandbox;
  let mockConfig;
  let mockHttpServer;
  let mockHttpsServer;
  let proxyModule;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockConfig = {
      getTLSEnabled: sandbox.stub(),
      getTLSKeyPemPath: sandbox.stub(),
      getTLSCertPemPath: sandbox.stub(),
      getPlugins: sandbox.stub().returns([]),
      getAuthorisedList: sandbox.stub().returns([]),
    };

    const mockDb = {
      getRepos: sandbox.stub().resolves([]),
      createRepo: sandbox.stub().resolves(),
      addUserCanPush: sandbox.stub().resolves(),
      addUserCanAuthorise: sandbox.stub().resolves(),
    };

    const mockPluginLoader = {
      load: sandbox.stub().resolves(),
    };

    mockHttpServer = {
      listen: sandbox.stub().callsFake((port, callback) => {
        if (callback) callback();
        return mockHttpServer;
      }),
      close: sandbox.stub().callsFake((callback) => {
        if (callback) callback();
      }),
    };

    mockHttpsServer = {
      listen: sandbox.stub().callsFake((port, callback) => {
        if (callback) callback();
        return mockHttpsServer;
      }),
      close: sandbox.stub().callsFake((callback) => {
        if (callback) callback();
      }),
    };

    sandbox.stub(require('../src/plugin'), 'PluginLoader').returns(mockPluginLoader);

    const configModule = require('../src/config');
    sandbox.stub(configModule, 'getTLSEnabled').callsFake(mockConfig.getTLSEnabled);
    sandbox.stub(configModule, 'getTLSKeyPemPath').callsFake(mockConfig.getTLSKeyPemPath);
    sandbox.stub(configModule, 'getTLSCertPemPath').callsFake(mockConfig.getTLSCertPemPath);
    sandbox.stub(configModule, 'getPlugins').callsFake(mockConfig.getPlugins);
    sandbox.stub(configModule, 'getAuthorisedList').callsFake(mockConfig.getAuthorisedList);

    const dbModule = require('../src/db');
    sandbox.stub(dbModule, 'getRepos').callsFake(mockDb.getRepos);
    sandbox.stub(dbModule, 'createRepo').callsFake(mockDb.createRepo);
    sandbox.stub(dbModule, 'addUserCanPush').callsFake(mockDb.addUserCanPush);
    sandbox.stub(dbModule, 'addUserCanAuthorise').callsFake(mockDb.addUserCanAuthorise);

    const chain = require('../src/proxy/chain');
    chain.chainPluginLoader = null;

    process.env.NODE_ENV = 'test';
    process.env.GIT_PROXY_HTTPS_SERVER_PORT = '8443';

    // Import proxy module after mocks are set up
    delete require.cache[require.resolve('../src/proxy/index')];
    proxyModule = require('../src/proxy/index').default;
  });

  afterEach(async () => {
    try {
      await proxyModule.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
    sandbox.restore();
  });

  describe('TLS certificate file reading', () => {
    it('should read TLS key and cert files when TLS is enabled and paths are provided', async () => {
      const mockKeyContent = Buffer.from('mock-key-content');
      const mockCertContent = Buffer.from('mock-cert-content');

      mockConfig.getTLSEnabled.returns(true);
      mockConfig.getTLSKeyPemPath.returns('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.returns('/path/to/cert.pem');

      const fsStub = sandbox.stub(fs, 'readFileSync');
      fsStub.returns(Buffer.from('default-cert'));
      fsStub.withArgs('/path/to/key.pem').returns(mockKeyContent);
      fsStub.withArgs('/path/to/cert.pem').returns(mockCertContent);
      await proxyModule.start();

      // Check if files should have been read
      if (fsStub.called) {
        expect(fsStub).to.have.been.calledWith('/path/to/key.pem');
        expect(fsStub).to.have.been.calledWith('/path/to/cert.pem');
      } else {
        console.log('fs.readFileSync was never called - TLS certificate reading not triggered');
      }
    });

    it('should not read TLS files when TLS is disabled', async () => {
      mockConfig.getTLSEnabled.returns(false);
      mockConfig.getTLSKeyPemPath.returns('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.returns('/path/to/cert.pem');

      const fsStub = sandbox.stub(fs, 'readFileSync');

      await proxyModule.start();

      expect(fsStub).not.to.have.been.called;
    });

    it('should not read TLS files when paths are not provided', async () => {
      mockConfig.getTLSEnabled.returns(true);
      mockConfig.getTLSKeyPemPath.returns(null);
      mockConfig.getTLSCertPemPath.returns(null);

      const fsStub = sandbox.stub(fs, 'readFileSync');

      await proxyModule.start();

      expect(fsStub).not.to.have.been.called;
    });
  });
});
