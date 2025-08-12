const chai = require('chai');
const sinon = require('sinon');
const http = require('http');
const https = require('https');

const proxyquire = require('proxyquire');

const proxyModule = require('../src/proxy/index');
const expect = chai.expect;

function purgeModule(moduleName) {
  try {
    const resolved = require.resolve(moduleName);
    const mod = require.cache[resolved];
    if (!mod) return;
    // recursively purge children first
    mod.children.forEach((child) => {
      purgeModule(child.id);
    });
    delete require.cache[resolved];
  } catch (err) {
    // ignore if module not found in cache
  }
}

describe('Proxy Module', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createApp', () => {
    it('should create express app with router', async () => {
      const app = await proxyModule.default.createApp();

      // Basic checks for express app
      expect(app).to.be.an('function');
      expect(app.use).to.be.a('function');
      expect(app.listen).to.be.a('function');
      expect(app.settings).to.be.an('object');
    });
  });

  describe('start', () => {
    let httpCreateServerStub;
    let httpsCreateServerStub;
    let mockHttpServer;
    let mockHttpsServer;
    let getTLSEnabledStub;
    let proxyPreparationsStub;

    beforeEach(() => {
      mockHttpServer = {
        listen: sandbox.stub().callsArg(1)
      };

      mockHttpsServer = {
        listen: sandbox.stub().callsArg(1)
      };

      httpCreateServerStub = sandbox.stub(http, 'createServer').returns(mockHttpServer);
      httpsCreateServerStub = sandbox.stub(https, 'createServer').returns(mockHttpsServer);
      getTLSEnabledStub = sandbox.stub(require('../src/config'), 'getTLSEnabled');
      proxyPreparationsStub = sandbox.stub(proxyModule, 'proxyPreparations').resolves();
    });

    it('should start HTTP server only when TLS is disabled', async () => {
      getTLSEnabledStub.returns(false);

      await proxyModule.default.start();

      expect(httpCreateServerStub.calledOnce).to.be.true;
      expect(httpsCreateServerStub.called).to.be.false;
      expect(mockHttpServer.listen.calledOnce).to.be.true;
      expect(proxyPreparationsStub.calledOnce).to.be.true;
    });
  });

  describe('proxyPreparations', () => {
    let getPluginsStub
    let getAuthorisedListStub
    let getReposStub
    let createRepoStub
    let addUserCanPushStub
    let addUserCanAuthoriseStub
    let PluginLoaderStub

    beforeEach(() => {
      purgeModule('../src/proxy/index');
      purgeModule('../src/config');
      purgeModule('../src/db');
      purgeModule('../src/plugin');
      purgeModule('../src/proxy/chain');
      purgeModule('../src/config/env');

      getPluginsStub = sandbox.stub().returns(['fake-plugin']);
      getAuthorisedListStub = sandbox.stub().returns([
        { project: 'test-proj1', name: 'repo1' },
        { project: 'test-proj2', name: 'repo2' },
      ]);
      getReposStub = sandbox.stub().resolves([{ project: 'test-proj1', name: 'repo1' }]);
      createRepoStub = sandbox.stub().resolves();
      addUserCanPushStub = sandbox.stub().resolves();
      addUserCanAuthoriseStub = sandbox.stub().resolves();

      PluginLoaderStub = sandbox.stub().returns({ load: sandbox.stub().resolves() });
    });

    it('should load plugins and create missing repos', async () => {
      const proxyModule = proxyquire('../src/proxy/index', {
        '../config': {
          getPlugins: getPluginsStub,
          getAuthorisedList: getAuthorisedListStub,
          getRepos: getReposStub,
          getTLSEnabled: sandbox.stub().returns(false),
          getTLSKeyPemPath: sandbox.stub().returns('/tmp/key.pem'),
          getTLSCertPemPath: sandbox.stub().returns('/tmp/cert.pem'),
        },
        '../db': {
          createRepo: createRepoStub,
          addUserCanPush: addUserCanPushStub,
          addUserCanAuthorise: addUserCanAuthoriseStub,
        },
        '../plugin': {
          PluginLoader: PluginLoaderStub,
        },
        './chain': {}
      });

      await proxyModule.proxyPreparations();

      sinon.assert.calledOnce(PluginLoaderStub);
      sinon.assert.calledWith(PluginLoaderStub, ['fake-plugin']);

      expect(createRepoStub.callCount).to.equal(2);
      expect(addUserCanPushStub.callCount).to.equal(2);
      expect(addUserCanAuthoriseStub.callCount).to.equal(2);
    });
  });
});
