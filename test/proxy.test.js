const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const http = require('http');
const https = require('https');
const fs = require('fs');
const express = require('express');
const proxyModule = require('../src/proxy/index').default;

chai.use(chaiHttp);
chai.use(sinonChai);
chai.should();
const { expect } = chai;

describe('Proxy Module', () => {
  let sandbox;
  let mockConfig;
  let mockPluginLoader;
  let mockDb;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockConfig = {
      getPlugins: sandbox.stub().returns([]),
      getAuthorisedList: sandbox.stub().returns([]),
      getTLSEnabled: sandbox.stub().returns(false),
      getTLSKeyPemPath: sandbox.stub().returns(null),
      getTLSCertPemPath: sandbox.stub().returns(null),
    };

    mockDb = {
      getRepos: sandbox.stub().resolves([]),
      createRepo: sandbox.stub().resolves(),
      addUserCanPush: sandbox.stub().resolves(),
      addUserCanAuthorise: sandbox.stub().resolves(),
    };

    mockPluginLoader = {
      load: sandbox.stub().resolves(),
    };

    sandbox.stub(require('../src/plugin'), 'PluginLoader').returns(mockPluginLoader);

    const configModule = require('../src/config');
    sandbox.stub(configModule, 'getPlugins').callsFake(mockConfig.getPlugins);
    sandbox.stub(configModule, 'getAuthorisedList').callsFake(mockConfig.getAuthorisedList);
    sandbox.stub(configModule, 'getTLSEnabled').callsFake(mockConfig.getTLSEnabled);
    sandbox.stub(configModule, 'getTLSKeyPemPath').callsFake(mockConfig.getTLSKeyPemPath);
    sandbox.stub(configModule, 'getTLSCertPemPath').callsFake(mockConfig.getTLSCertPemPath);

    const dbModule = require('../src/db');
    sandbox.stub(dbModule, 'getRepos').callsFake(mockDb.getRepos);
    sandbox.stub(dbModule, 'createRepo').callsFake(mockDb.createRepo);
    sandbox.stub(dbModule, 'addUserCanPush').callsFake(mockDb.addUserCanPush);
    sandbox.stub(dbModule, 'addUserCanAuthorise').callsFake(mockDb.addUserCanAuthorise);

    const chain = require('../src/proxy/chain');
    chain.chainPluginLoader = null;

    process.env.NODE_ENV = 'test';
    process.env.GIT_PROXY_SERVER_PORT = '8080';
    process.env.GIT_PROXY_HTTPS_SERVER_PORT = '8443';
  });

  afterEach(async () => {
    try {
      await proxyModule.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
    sandbox.restore();
  });

  describe('proxyPreparations', () => {
    it('should load plugins successfully', async () => {
      mockConfig.getPlugins.returns([{ name: 'test-plugin' }]);

      await proxyModule.proxyPreparations();

      expect(mockPluginLoader.load).to.have.been.calledOnce;
    });

    it('should setup default repositories', async () => {
      const defaultRepo = { project: 'test', name: 'repo' };
      mockConfig.getAuthorisedList.returns([defaultRepo]);
      mockDb.getRepos.resolves([]);

      await proxyModule.proxyPreparations();

      expect(mockDb.createRepo).to.have.been.calledWith(defaultRepo);
    });

    it('should not create existing repositories', async () => {
      const existingRepo = { project: 'test', name: 'repo' };
      mockConfig.getAuthorisedList.returns([existingRepo]);
      mockDb.getRepos.resolves([existingRepo]);

      await proxyModule.proxyPreparations();

      expect(mockDb.createRepo).not.to.have.been.called;
    });

    it('should handle plugin loading errors', async () => {
      mockPluginLoader.load.rejects(new Error('Plugin load failed'));

      try {
        await proxyModule.proxyPreparations();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Plugin load failed');
      }
    });
  });

  describe('createApp', () => {
    it('should create an Express application', async () => {
      const app = await proxyModule.createApp();

      expect(app).to.be.a('function');
      expect(app).to.have.property('use');
      expect(app).to.have.property('listen');
    });

    it('should setup router', async () => {
      const mockUse = sandbox.spy();
      sandbox.stub(express, 'Router').returns(mockUse);

      await proxyModule.createApp();
    });
  });

  describe('start', () => {
    let httpCreateServerStub;
    let httpsCreateServerStub;
    let mockHttpServer;
    let mockHttpsServer;

    beforeEach(() => {
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

      httpCreateServerStub = sandbox.stub(http, 'createServer').returns(mockHttpServer);
      httpsCreateServerStub = sandbox.stub(https, 'createServer').returns(mockHttpsServer);
      sandbox.stub(fs, 'readFileSync').returns(Buffer.from('mock-cert'));
    });

    it('should start HTTP server', async () => {
      mockConfig.getTLSEnabled.returns(false);

      const app = await proxyModule.start();

      expect(app).to.be.a('function');
      expect(httpCreateServerStub).to.have.been.calledOnce;
      expect(mockHttpServer.listen).to.have.been.calledWith(8000);
    });

    it('should start both HTTP and HTTPS servers when TLS enabled', async () => {
      mockConfig.getTLSEnabled.returns(true);
      mockConfig.getTLSKeyPemPath.returns('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.returns('/path/to/cert.pem');

      const app = await proxyModule.start();

      expect(app).to.be.a('function');
      expect(httpCreateServerStub).to.have.been.calledOnce;
      expect(httpsCreateServerStub).to.have.been.calledOnce;
      expect(mockHttpServer.listen).to.have.been.calledWith(8000);
      expect(mockHttpsServer.listen).to.have.been.calledWith(8443);
    });

    it('should call proxyPreparations', async () => {
      const app = await proxyModule.start();

      expect(app).to.be.a('function');
    });
  });

  describe('stop', () => {
    let mockHttpServer;
    let mockHttpsServer;

    beforeEach(() => {
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

      sandbox.stub(http, 'createServer').returns(mockHttpServer);
      sandbox.stub(https, 'createServer').returns(mockHttpsServer);
      sandbox.stub(fs, 'readFileSync').returns(Buffer.from('mock-cert'));
    });

    it('should stop servers gracefully', async () => {
      mockConfig.getTLSEnabled.returns(true);
      mockConfig.getTLSKeyPemPath.returns('/path/to/key.pem');
      mockConfig.getTLSCertPemPath.returns('/path/to/cert.pem');

      await proxyModule.start();

      await proxyModule.stop();

      expect(mockHttpServer.close).to.have.been.calledOnce;
      expect(mockHttpsServer.close).to.have.been.calledOnce;
    });

    it('should handle server close errors', async () => {
      mockHttpServer.close.callsFake((callback) => {
        throw new Error('Close error');
      });

      await proxyModule.start();

      try {
        await proxyModule.stop();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Close error');
      }
    });
  });
});
