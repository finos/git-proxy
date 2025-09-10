const chai = require('chai');
const sinon = require('sinon');
const http = require('http');
const https = require('https');
const proxyquire = require('proxyquire');

const expect = chai.expect;

describe('Proxy', () => {
  let sandbox;
  let Proxy;
  let mockHttpServer;
  let mockHttpsServer;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockHttpServer = {
      listen: sandbox.stub().callsFake((port, callback) => {
        if (callback) setImmediate(callback);
        return mockHttpServer;
      }),
      close: sandbox.stub().callsFake((callback) => {
        if (callback) setImmediate(callback);
        return mockHttpServer;
      }),
    };

    mockHttpsServer = {
      listen: sandbox.stub().callsFake((port, callback) => {
        if (callback) setImmediate(callback);
        return mockHttpsServer;
      }),
      close: sandbox.stub().callsFake((callback) => {
        if (callback) setImmediate(callback);
        return mockHttpsServer;
      }),
    };

    sandbox.stub(http, 'createServer').returns(mockHttpServer);
    sandbox.stub(https, 'createServer').returns(mockHttpsServer);

    // deep mocking for express router
    const mockRouter = sandbox.stub();
    mockRouter.use = sandbox.stub();
    mockRouter.get = sandbox.stub();
    mockRouter.post = sandbox.stub();
    mockRouter.stack = [];

    Proxy = proxyquire('../src/proxy/index', {
      './routes': {
        getRouter: sandbox.stub().resolves(mockRouter),
      },
      '../config': {
        getTLSEnabled: sandbox.stub().returns(false),
        getTLSKeyPemPath: sandbox.stub().returns('/tmp/key.pem'),
        getTLSCertPemPath: sandbox.stub().returns('/tmp/cert.pem'),
        getPlugins: sandbox.stub().returns(['mock-plugin']),
        getAuthorisedList: sandbox.stub().returns([{ project: 'test-proj', name: 'test-repo' }]),
      },
      '../db': {
        getRepos: sandbox.stub().resolves([]),
        createRepo: sandbox.stub().resolves({ _id: 'mock-repo-id' }),
        addUserCanPush: sandbox.stub().resolves(),
        addUserCanAuthorise: sandbox.stub().resolves(),
      },
      '../plugin': {
        PluginLoader: sandbox.stub().returns({
          load: sandbox.stub().resolves(),
        }),
      },
      './chain': {
        default: {},
      },
      '../config/env': {
        serverConfig: {
          GIT_PROXY_SERVER_PORT: 3000,
          GIT_PROXY_HTTPS_SERVER_PORT: 3001,
        },
      },
      fs: {
        readFileSync: sandbox.stub().returns(Buffer.from('mock-cert')),
      },
    }).default;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('start()', () => {
    it('should start HTTP server when TLS is disabled', async () => {
      const proxy = new Proxy();

      await proxy.start();

      expect(http.createServer.calledOnce).to.be.true;
      expect(https.createServer.called).to.be.false;
      expect(mockHttpServer.listen.calledWith(3000)).to.be.true;

      await proxy.stop();
    });

    it('should start both HTTP and HTTPS servers when TLS is enabled', async () => {
      const mockRouterTLS = sandbox.stub();
      mockRouterTLS.use = sandbox.stub();
      mockRouterTLS.get = sandbox.stub();
      mockRouterTLS.post = sandbox.stub();
      mockRouterTLS.stack = [];

      const ProxyWithTLS = proxyquire('../src/proxy/index', {
        './routes': {
          getRouter: sandbox.stub().resolves(mockRouterTLS),
        },
        '../config': {
          getTLSEnabled: sandbox.stub().returns(true), // TLS enabled
          getTLSKeyPemPath: sandbox.stub().returns('/tmp/key.pem'),
          getTLSCertPemPath: sandbox.stub().returns('/tmp/cert.pem'),
          getPlugins: sandbox.stub().returns(['mock-plugin']),
          getAuthorisedList: sandbox.stub().returns([]),
        },
        '../db': {
          getRepos: sandbox.stub().resolves([]),
          createRepo: sandbox.stub().resolves({ _id: 'mock-repo-id' }),
          addUserCanPush: sandbox.stub().resolves(),
          addUserCanAuthorise: sandbox.stub().resolves(),
        },
        '../plugin': {
          PluginLoader: sandbox.stub().returns({
            load: sandbox.stub().resolves(),
          }),
        },
        './chain': {
          default: {},
        },
        '../config/env': {
          serverConfig: {
            GIT_PROXY_SERVER_PORT: 3000,
            GIT_PROXY_HTTPS_SERVER_PORT: 3001,
          },
        },
        fs: {
          readFileSync: sandbox.stub().returns(Buffer.from('mock-cert')),
        },
      }).default;

      const proxy = new ProxyWithTLS();

      await proxy.start();

      expect(http.createServer.calledOnce).to.be.true;
      expect(https.createServer.calledOnce).to.be.true;
      expect(mockHttpServer.listen.calledWith(3000)).to.be.true;
      expect(mockHttpsServer.listen.calledWith(3001)).to.be.true;

      await proxy.stop();
    });

    it('should set up express app after starting', async () => {
      const proxy = new Proxy();
      expect(proxy.getExpressApp()).to.be.null;

      await proxy.start();

      expect(proxy.getExpressApp()).to.not.be.null;
      expect(proxy.getExpressApp()).to.be.a('function');

      await proxy.stop();
    });
  });

  describe('getExpressApp()', () => {
    it('should return null before start() is called', () => {
      const proxy = new Proxy();

      expect(proxy.getExpressApp()).to.be.null;
    });

    it('should return express app after start() is called', async () => {
      const proxy = new Proxy();

      await proxy.start();

      const app = proxy.getExpressApp();
      expect(app).to.not.be.null;
      expect(app).to.be.a('function');
      expect(app.use).to.be.a('function');

      await proxy.stop();
    });
  });

  describe('stop()', () => {
    it('should close HTTP server when running', async () => {
      const proxy = new Proxy();
      await proxy.start();
      await proxy.stop();

      expect(mockHttpServer.close.calledOnce).to.be.true;
    });

    it('should close both HTTP and HTTPS servers when both are running', async () => {
      const mockRouterStop = sandbox.stub();
      mockRouterStop.use = sandbox.stub();
      mockRouterStop.get = sandbox.stub();
      mockRouterStop.post = sandbox.stub();
      mockRouterStop.stack = [];

      const ProxyWithTLS = proxyquire('../src/proxy/index', {
        './routes': {
          getRouter: sandbox.stub().resolves(mockRouterStop),
        },
        '../config': {
          getTLSEnabled: sandbox.stub().returns(true),
          getTLSKeyPemPath: sandbox.stub().returns('/tmp/key.pem'),
          getTLSCertPemPath: sandbox.stub().returns('/tmp/cert.pem'),
          getPlugins: sandbox.stub().returns([]),
          getAuthorisedList: sandbox.stub().returns([]),
        },
        '../db': {
          getRepos: sandbox.stub().resolves([]),
          createRepo: sandbox.stub().resolves({ _id: 'mock-repo-id' }),
          addUserCanPush: sandbox.stub().resolves(),
          addUserCanAuthorise: sandbox.stub().resolves(),
        },
        '../plugin': {
          PluginLoader: sandbox.stub().returns({
            load: sandbox.stub().resolves(),
          }),
        },
        './chain': {
          default: {},
        },
        '../config/env': {
          serverConfig: {
            GIT_PROXY_SERVER_PORT: 3000,
            GIT_PROXY_HTTPS_SERVER_PORT: 3001,
          },
        },
        fs: {
          readFileSync: sandbox.stub().returns(Buffer.from('mock-cert')),
        },
      }).default;

      const proxy = new ProxyWithTLS();
      await proxy.start();
      await proxy.stop();

      expect(mockHttpServer.close.calledOnce).to.be.true;
      expect(mockHttpsServer.close.calledOnce).to.be.true;
    });

    it('should resolve successfully when no servers are running', async () => {
      const proxy = new Proxy();

      await proxy.stop();

      expect(mockHttpServer.close.called).to.be.false;
      expect(mockHttpsServer.close.called).to.be.false;
    });

    it('should handle errors gracefully', async () => {
      const proxy = new Proxy();
      await proxy.start();

      // simulate error in server close
      mockHttpServer.close.callsFake((callback) => {
        throw new Error('Server close error');
      });

      try {
        await proxy.stop();
        expect.fail('Expected stop() to reject');
      } catch (error) {
        expect(error.message).to.equal('Server close error');
      }
    });
  });

  describe('full lifecycle', () => {
    it('should start and stop successfully', async () => {
      const proxy = new Proxy();

      await proxy.start();
      expect(proxy.getExpressApp()).to.not.be.null;
      expect(mockHttpServer.listen.calledOnce).to.be.true;

      await proxy.stop();
      expect(mockHttpServer.close.calledOnce).to.be.true;
    });

    it('should handle multiple start/stop cycles', async () => {
      const proxy = new Proxy();

      await proxy.start();
      await proxy.stop();

      mockHttpServer.listen.resetHistory();
      mockHttpServer.close.resetHistory();

      await proxy.start();
      await proxy.stop();

      expect(mockHttpServer.listen.calledOnce).to.be.true;
      expect(mockHttpServer.close.calledOnce).to.be.true;
    });
  });
});
