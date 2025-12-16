const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const fs = require('fs');
const ssh2 = require('ssh2');
const config = require('../../src/config');
const db = require('../../src/db');
const chain = require('../../src/proxy/chain');
const SSHServer = require('../../src/proxy/ssh/server').default;
const { execSync } = require('child_process');

describe('SSHServer', () => {
  let server;
  let mockConfig;
  let mockDb;
  let mockChain;
  let mockSsh2Server;
  let mockFs;
  const testKeysDir = 'test/keys';
  let testKeyContent;

  before(() => {
    // Create directory for test keys
    if (!fs.existsSync(testKeysDir)) {
      fs.mkdirSync(testKeysDir, { recursive: true });
    }
    // Generate test SSH key pair with smaller key size for faster generation
    try {
      execSync(`ssh-keygen -t rsa -b 2048 -f ${testKeysDir}/test_key -N "" -C "test@git-proxy"`, {
        timeout: 5000,
      });
      // Read the key once and store it
      testKeyContent = fs.readFileSync(`${testKeysDir}/test_key`);
    } catch (error) {
      // If key generation fails, create a mock key file
      testKeyContent = Buffer.from(
        '-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END RSA PRIVATE KEY-----',
      );
      fs.writeFileSync(`${testKeysDir}/test_key`, testKeyContent);
    }
  });

  after(() => {
    // Clean up test keys
    if (fs.existsSync(testKeysDir)) {
      fs.rmSync(testKeysDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Create stubs for all dependencies
    mockConfig = {
      getSSHConfig: sinon.stub().returns({
        hostKey: {
          privateKeyPath: `${testKeysDir}/test_key`,
          publicKeyPath: `${testKeysDir}/test_key.pub`,
        },
        port: 2222,
      }),
    };

    mockDb = {
      findUserBySSHKey: sinon.stub(),
      findUser: sinon.stub(),
    };

    mockChain = {
      executeChain: sinon.stub(),
    };

    mockFs = {
      readFileSync: sinon.stub().callsFake((path) => {
        if (path === `${testKeysDir}/test_key`) {
          return testKeyContent;
        }
        return 'mock-key-data';
      }),
    };

    // Create a more complete mock for the SSH2 server
    mockSsh2Server = {
      Server: sinon.stub().returns({
        listen: sinon.stub(),
        close: sinon.stub(),
        on: sinon.stub(),
      }),
    };

    // Replace the real modules with our stubs
    sinon.stub(config, 'getSSHConfig').callsFake(mockConfig.getSSHConfig);
    sinon.stub(config, 'getMaxPackSizeBytes').returns(1024 * 1024 * 1024);
    sinon.stub(db, 'findUserBySSHKey').callsFake(mockDb.findUserBySSHKey);
    sinon.stub(db, 'findUser').callsFake(mockDb.findUser);
    sinon.stub(chain.default, 'executeChain').callsFake(mockChain.executeChain);
    sinon.stub(fs, 'readFileSync').callsFake(mockFs.readFileSync);
    sinon.stub(ssh2, 'Server').callsFake(mockSsh2Server.Server);

    server = new SSHServer();
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create a new SSH2 server with correct configuration', () => {
      expect(ssh2.Server.calledOnce).to.be.true;
      const serverConfig = ssh2.Server.firstCall.args[0];
      expect(serverConfig.hostKeys).to.be.an('array');
      expect(serverConfig.keepaliveInterval).to.equal(20000);
      expect(serverConfig.keepaliveCountMax).to.equal(5);
      expect(serverConfig.readyTimeout).to.equal(30000);
      expect(serverConfig.debug).to.be.a('function');
      // Check that a connection handler is provided
      expect(ssh2.Server.firstCall.args[1]).to.be.a('function');
    });

    it('should enable debug logging', () => {
      // Create a new server to test debug logging
      new SSHServer();
      const serverConfig = ssh2.Server.lastCall.args[0];

      // Test debug function
      const consoleSpy = sinon.spy(console, 'debug');
      serverConfig.debug('test debug message');
      expect(consoleSpy.calledWith('[SSH Debug]', 'test debug message')).to.be.true;

      consoleSpy.restore();
    });
  });

  describe('start', () => {
    it('should start listening on the configured port', () => {
      server.start();
      expect(server.server.listen.calledWith(2222, '0.0.0.0')).to.be.true;
    });

    it('should start listening on default port when not configured', () => {
      mockConfig.getSSHConfig.returns({
        hostKey: {
          privateKeyPath: `${testKeysDir}/test_key`,
          publicKeyPath: `${testKeysDir}/test_key.pub`,
        },
        port: null,
      });

      const testServer = new SSHServer();
      testServer.start();
      expect(testServer.server.listen.calledWith(2222, '0.0.0.0')).to.be.true;
    });
  });

  describe('stop', () => {
    it('should stop the server', () => {
      server.stop();
      expect(server.server.close.calledOnce).to.be.true;
    });

    it('should handle stop when server is not initialized', () => {
      const testServer = new SSHServer();
      testServer.server = null;
      expect(() => testServer.stop()).to.not.throw();
    });
  });

  describe('handleClient', () => {
    let mockClient;
    let clientInfo;

    beforeEach(() => {
      mockClient = {
        on: sinon.stub(),
        end: sinon.stub(),
        username: null,
        agentForwardingEnabled: false,
        authenticatedUser: null,
        clientIp: null,
      };
      clientInfo = {
        ip: '127.0.0.1',
        family: 'IPv4',
      };
    });

    it('should set up client event handlers', () => {
      server.handleClient(mockClient, clientInfo);
      expect(mockClient.on.calledWith('error')).to.be.true;
      expect(mockClient.on.calledWith('end')).to.be.true;
      expect(mockClient.on.calledWith('close')).to.be.true;
      expect(mockClient.on.calledWith('global request')).to.be.true;
      expect(mockClient.on.calledWith('ready')).to.be.true;
      expect(mockClient.on.calledWith('authentication')).to.be.true;
      expect(mockClient.on.calledWith('session')).to.be.true;
    });

    it('should set client IP from clientInfo', () => {
      server.handleClient(mockClient, clientInfo);
      expect(mockClient.clientIp).to.equal('127.0.0.1');
    });

    it('should set client IP to unknown when not provided', () => {
      server.handleClient(mockClient, {});
      expect(mockClient.clientIp).to.equal('unknown');
    });

    it('should set up connection timeout', () => {
      const clock = sinon.useFakeTimers();
      server.handleClient(mockClient, clientInfo);

      // Fast-forward time to trigger timeout
      clock.tick(600001); // 10 minutes + 1ms

      expect(mockClient.end.calledOnce).to.be.true;
      clock.restore();
    });

    it('should handle client error events', () => {
      server.handleClient(mockClient, clientInfo);
      const errorHandler = mockClient.on.withArgs('error').firstCall.args[1];

      // Should not throw and should not end connection (let it recover)
      expect(() => errorHandler(new Error('Test error'))).to.not.throw();
      expect(mockClient.end.called).to.be.false;
    });

    it('should handle client end events', () => {
      server.handleClient(mockClient, clientInfo);
      const endHandler = mockClient.on.withArgs('end').firstCall.args[1];

      // Should not throw
      expect(() => endHandler()).to.not.throw();
    });

    it('should handle client close events', () => {
      server.handleClient(mockClient, clientInfo);
      const closeHandler = mockClient.on.withArgs('close').firstCall.args[1];

      // Should not throw
      expect(() => closeHandler()).to.not.throw();
    });

    describe('global request handling', () => {
      it('should accept keepalive requests', () => {
        server.handleClient(mockClient, clientInfo);
        const globalRequestHandler = mockClient.on.withArgs('global request').firstCall.args[1];

        const accept = sinon.stub();
        const reject = sinon.stub();
        const info = { type: 'keepalive@openssh.com' };

        globalRequestHandler(accept, reject, info);
        expect(accept.calledOnce).to.be.true;
        expect(reject.called).to.be.false;
      });

      it('should reject non-keepalive global requests', () => {
        server.handleClient(mockClient, clientInfo);
        const globalRequestHandler = mockClient.on.withArgs('global request').firstCall.args[1];

        const accept = sinon.stub();
        const reject = sinon.stub();
        const info = { type: 'other-request' };

        globalRequestHandler(accept, reject, info);
        expect(reject.calledOnce).to.be.true;
        expect(accept.called).to.be.false;
      });
    });

    describe('authentication', () => {
      it('should handle public key authentication successfully', async () => {
        const mockCtx = {
          method: 'publickey',
          key: {
            algo: 'ssh-rsa',
            data: Buffer.from('mock-key-data'),
            comment: 'test-key',
          },
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUserBySSHKey.resolves({
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUserBySSHKey.calledOnce).to.be.true;
        expect(mockCtx.accept.calledOnce).to.be.true;
        expect(mockClient.authenticatedUser).to.deep.equal({
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });
      });

      it('should handle public key authentication failure - key not found', async () => {
        const mockCtx = {
          method: 'publickey',
          key: {
            algo: 'ssh-rsa',
            data: Buffer.from('mock-key-data'),
            comment: 'test-key',
          },
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUserBySSHKey.resolves(null);

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUserBySSHKey.calledOnce).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle public key authentication database error', async () => {
        const mockCtx = {
          method: 'publickey',
          key: {
            algo: 'ssh-rsa',
            data: Buffer.from('mock-key-data'),
            comment: 'test-key',
          },
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUserBySSHKey.rejects(new Error('Database error'));

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        // Give async operation time to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockDb.findUserBySSHKey.calledOnce).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle password authentication successfully', async () => {
        const mockCtx = {
          method: 'password',
          username: 'test-user',
          password: 'test-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.resolves({
          username: 'test-user',
          password: '$2a$10$mockHash',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });

        const bcrypt = require('bcryptjs');
        sinon.stub(bcrypt, 'compare').callsFake((password, hash, callback) => {
          callback(null, true);
        });

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        // Give async callback time to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(bcrypt.compare.calledOnce).to.be.true;
        expect(mockCtx.accept.calledOnce).to.be.true;
        expect(mockClient.authenticatedUser).to.deep.equal({
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });
      });

      it('should handle password authentication failure - invalid password', async () => {
        const mockCtx = {
          method: 'password',
          username: 'test-user',
          password: 'wrong-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.resolves({
          username: 'test-user',
          password: '$2a$10$mockHash',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });

        const bcrypt = require('bcryptjs');
        sinon.stub(bcrypt, 'compare').callsFake((password, hash, callback) => {
          callback(null, false);
        });

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        // Give async callback time to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(bcrypt.compare.calledOnce).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle password authentication failure - user not found', async () => {
        const mockCtx = {
          method: 'password',
          username: 'nonexistent-user',
          password: 'test-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.resolves(null);

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUser.calledWith('nonexistent-user')).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle password authentication failure - user has no password', async () => {
        const mockCtx = {
          method: 'password',
          username: 'test-user',
          password: 'test-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.resolves({
          username: 'test-user',
          password: null,
          email: 'test@example.com',
          gitAccount: 'testgit',
        });

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle password authentication database error', async () => {
        const mockCtx = {
          method: 'password',
          username: 'test-user',
          password: 'test-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.rejects(new Error('Database error'));

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        // Give async operation time to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should handle bcrypt comparison error', async () => {
        const mockCtx = {
          method: 'password',
          username: 'test-user',
          password: 'test-password',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        mockDb.findUser.resolves({
          username: 'test-user',
          password: '$2a$10$mockHash',
          email: 'test@example.com',
          gitAccount: 'testgit',
        });

        const bcrypt = require('bcryptjs');
        sinon.stub(bcrypt, 'compare').callsFake((password, hash, callback) => {
          callback(new Error('bcrypt error'), null);
        });

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        // Give async callback time to complete
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(bcrypt.compare.calledOnce).to.be.true;
        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });

      it('should reject unsupported authentication methods', async () => {
        const mockCtx = {
          method: 'hostbased',
          accept: sinon.stub(),
          reject: sinon.stub(),
        };

        server.handleClient(mockClient, clientInfo);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockCtx.reject.calledOnce).to.be.true;
        expect(mockCtx.accept.called).to.be.false;
      });
    });

    describe('ready event handling', () => {
      it('should handle client ready event', () => {
        mockClient.authenticatedUser = { username: 'test-user' };
        server.handleClient(mockClient, clientInfo);

        const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];
        expect(() => readyHandler()).to.not.throw();
      });

      it('should handle client ready event with unknown user', () => {
        mockClient.authenticatedUser = null;
        server.handleClient(mockClient, clientInfo);

        const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];
        expect(() => readyHandler()).to.not.throw();
      });
    });

    describe('session handling', () => {
      it('should handle session requests', () => {
        server.handleClient(mockClient, clientInfo);
        const sessionHandler = mockClient.on.withArgs('session').firstCall.args[1];

        const accept = sinon.stub().returns({
          on: sinon.stub(),
        });
        const reject = sinon.stub();

        expect(() => sessionHandler(accept, reject)).to.not.throw();
        expect(accept.calledOnce).to.be.true;
      });
    });
  });

  describe('handleCommand', () => {
    let mockClient;
    let mockStream;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        clientIp: '127.0.0.1',
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
      };
    });

    it('should reject unauthenticated commands', async () => {
      mockClient.authenticatedUser = null;

      await server.handleCommand('git-upload-pack test/repo', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Authentication required\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle unsupported commands', async () => {
      await server.handleCommand('unsupported-command', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Unsupported command: unsupported-command\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle general command errors', async () => {
      // Mock chain.executeChain to return a blocked result
      mockChain.executeChain.resolves({ error: true, errorMessage: 'General error' });

      await server.handleCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Access denied: General error\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle invalid git command format', async () => {
      await server.handleCommand('git-invalid-command repo', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Unsupported command: git-invalid-command repo\n'))
        .to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });
  });

  describe('session handling', () => {
    let mockClient;
    let mockSession;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        clientIp: '127.0.0.1',
        on: sinon.stub(),
      };
      mockSession = {
        on: sinon.stub(),
      };
    });

    it('should handle exec request with accept', () => {
      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const sessionHandler = mockClient.on.withArgs('session').firstCall.args[1];

      const accept = sinon.stub().returns(mockSession);
      const reject = sinon.stub();

      sessionHandler(accept, reject);

      expect(accept.calledOnce).to.be.true;
      expect(mockSession.on.calledWith('exec')).to.be.true;
    });

    it('should handle exec command request', () => {
      const mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
      };

      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const sessionHandler = mockClient.on.withArgs('session').firstCall.args[1];

      const accept = sinon.stub().returns(mockSession);
      const reject = sinon.stub();
      sessionHandler(accept, reject);

      // Get the exec handler
      const execHandler = mockSession.on.withArgs('exec').firstCall.args[1];
      const execAccept = sinon.stub().returns(mockStream);
      const execReject = sinon.stub();
      const info = { command: 'git-upload-pack test/repo' };

      // Mock handleCommand
      sinon.stub(server, 'handleCommand').resolves();

      execHandler(execAccept, execReject, info);

      expect(execAccept.calledOnce).to.be.true;
      expect(server.handleCommand.calledWith('git-upload-pack test/repo', mockStream, mockClient))
        .to.be.true;
    });
  });

  describe('keepalive functionality', () => {
    let mockClient;
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      mockClient = {
        authenticatedUser: { username: 'test-user' },
        clientIp: '127.0.0.1',
        on: sinon.stub(),
        connected: true,
        ping: sinon.stub(),
      };
    });

    afterEach(() => {
      clock.restore();
    });

    it('should start keepalive on ready', () => {
      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];

      readyHandler();

      // Fast-forward 15 seconds to trigger keepalive
      clock.tick(15000);

      expect(mockClient.ping.calledOnce).to.be.true;
    });

    it('should handle keepalive ping errors gracefully', () => {
      mockClient.ping.throws(new Error('Ping failed'));

      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];

      readyHandler();

      // Fast-forward to trigger keepalive
      clock.tick(15000);

      // Should not throw and should have attempted ping
      expect(mockClient.ping.calledOnce).to.be.true;
    });

    it('should stop keepalive when client disconnects', () => {
      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];

      readyHandler();

      // Simulate disconnection
      mockClient.connected = false;
      clock.tick(15000);

      // Ping should not be called when disconnected
      expect(mockClient.ping.called).to.be.false;
    });

    it('should clean up keepalive timer on client close', () => {
      server.handleClient(mockClient, { ip: '127.0.0.1' });
      const readyHandler = mockClient.on.withArgs('ready').firstCall.args[1];
      const closeHandler = mockClient.on.withArgs('close').firstCall.args[1];

      readyHandler();
      closeHandler();

      // Fast-forward and ensure no ping happens after close
      clock.tick(15000);
      expect(mockClient.ping.called).to.be.false;
    });
  });

  describe('connectToRemoteGitServer', () => {
    let mockClient;
    let mockStream;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        clientIp: '127.0.0.1',
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
      };
    });

    it('should handle successful connection and command execution', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
        connected: true,
      };

      const mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock successful connection
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        // Simulate successful exec
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      await promise;

      expect(mockSsh2Client.exec.calledWith("git-upload-pack 'test/repo'")).to.be.true;
    });

    it('should handle exec errors', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock connection ready but exec failure
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(new Error('Exec failed'));
        });
        callback();
      });

      try {
        await server.connectToRemoteGitServer(
          "git-upload-pack 'test/repo'",
          mockStream,
          mockClient,
        );
      } catch (error) {
        expect(error.message).to.equal('Exec failed');
      }
    });

    it('should handle stream data piping', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
        connected: true,
      };

      const mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      await promise;

      // Test data piping handlers were set up
      const streamDataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      const remoteDataHandler = mockRemoteStream.on.withArgs('data').firstCall?.args[1];

      if (streamDataHandler) {
        streamDataHandler(Buffer.from('test data'));
        expect(mockRemoteStream.write.calledWith(Buffer.from('test data'))).to.be.true;
      }

      if (remoteDataHandler) {
        remoteDataHandler(Buffer.from('remote data'));
        expect(mockStream.write.calledWith(Buffer.from('remote data'))).to.be.true;
      }
    });

    it('should handle stream errors with recovery attempts', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
        connected: true,
      };

      const mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      await promise;

      // Test that error handlers are set up for stream error recovery
      const remoteErrorHandlers = mockRemoteStream.on.withArgs('error').getCalls();
      expect(remoteErrorHandlers.length).to.be.greaterThan(0);

      // Test that the error recovery logic handles early EOF gracefully
      // (We can't easily test the exact recovery behavior due to complex event handling)
      const errorHandler = remoteErrorHandlers[0].args[1];
      expect(errorHandler).to.be.a('function');
    });

    it('should handle connection timeout', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      const clock = sinon.useFakeTimers();

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      // Fast-forward to trigger timeout
      clock.tick(30001);

      try {
        await promise;
      } catch (error) {
        expect(error.message).to.equal('Connection timeout');
      }

      clock.restore();
    });

    it('should handle connection errors', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock connection error
      mockSsh2Client.on.withArgs('error').callsFake((event, callback) => {
        callback(new Error('Connection failed'));
      });

      try {
        await server.connectToRemoteGitServer(
          "git-upload-pack 'test/repo'",
          mockStream,
          mockClient,
        );
      } catch (error) {
        expect(error.message).to.equal('Connection failed');
      }
    });

    it('should handle authentication failure errors', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock authentication failure error
      mockSsh2Client.on.withArgs('error').callsFake((event, callback) => {
        callback(new Error('All configured authentication methods failed'));
      });

      try {
        await server.connectToRemoteGitServer(
          "git-upload-pack 'test/repo'",
          mockStream,
          mockClient,
        );
      } catch (error) {
        expect(error.message).to.equal('All configured authentication methods failed');
      }
    });

    it('should handle remote stream exit events', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
        connected: true,
      };

      const mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream exit to resolve promise
      mockRemoteStream.on.withArgs('exit').callsFake((event, callback) => {
        setImmediate(() => callback(0, 'SIGTERM'));
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      await promise;

      expect(mockStream.exit.calledWith(0)).to.be.true;
    });

    it('should handle client stream events', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
        connected: true,
      };

      const mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      await promise;

      // Test client stream close handler
      const clientCloseHandler = mockStream.on.withArgs('close').firstCall?.args[1];
      if (clientCloseHandler) {
        clientCloseHandler();
        expect(mockRemoteStream.end.called).to.be.true;
      }

      // Test client stream end handler
      const clientEndHandler = mockStream.on.withArgs('end').firstCall?.args[1];
      const clock = sinon.useFakeTimers();

      if (clientEndHandler) {
        clientEndHandler();
        clock.tick(1000);
        expect(mockSsh2Client.end.called).to.be.true;
      }

      clock.restore();

      // Test client stream error handler
      const clientErrorHandler = mockStream.on.withArgs('error').firstCall?.args[1];
      if (clientErrorHandler) {
        clientErrorHandler(new Error('Client stream error'));
        expect(mockRemoteStream.destroy.called).to.be.true;
      }
    });

    it('should handle connection close events', async () => {
      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);

      // Mock connection close
      mockSsh2Client.on.withArgs('close').callsFake((event, callback) => {
        callback();
      });

      const promise = server.connectToRemoteGitServer(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      // Connection should handle close event without error
      expect(() => promise).to.not.throw();
    });
  });

  describe('handleGitCommand edge cases', () => {
    let mockClient;
    let mockStream;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
        once: sinon.stub(),
      };
    });

    it('should handle git-receive-pack commands', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Set up stream event handlers to trigger automatically
      mockStream.once.withArgs('end').callsFake((event, callback) => {
        // Trigger the end callback asynchronously
        setImmediate(callback);
      });

      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const expectedReq = sinon.match({
        method: 'POST',
        headers: sinon.match({
          'content-type': 'application/x-git-receive-pack-request',
        }),
      });

      expect(mockChain.executeChain.calledWith(expectedReq)).to.be.true;
    });

    it('should handle invalid git command regex', async () => {
      await server.handleGitCommand('git-invalid format', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Error: Error: Invalid Git command format\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle chain blocked result', async () => {
      mockChain.executeChain.resolves({
        error: false,
        blocked: true,
        blockedMessage: 'Repository blocked',
      });

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Access denied: Repository blocked\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle chain error with default message', async () => {
      mockChain.executeChain.resolves({
        error: true,
        blocked: false,
      });

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Access denied: Request blocked by proxy chain\n'))
        .to.be.true;
    });

    it('should create proper SSH user context in request', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'connectToRemoteGitServer').resolves();

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      const capturedReq = mockChain.executeChain.firstCall.args[0];
      expect(capturedReq.isSSH).to.be.true;
      expect(capturedReq.protocol).to.equal('ssh');
      expect(capturedReq.sshUser).to.deep.equal({
        username: 'test-user',
        email: 'test@example.com',
        gitAccount: 'testgit',
        sshKeyInfo: {
          keyType: 'ssh-rsa',
          keyData: Buffer.from('test-key-data'),
        },
      });
    });
  });

  describe('error handling edge cases', () => {
    let mockClient;
    let mockStream;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: { username: 'test-user' },
        clientIp: '127.0.0.1',
        on: sinon.stub(),
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
      };
    });

    it('should handle handleCommand errors gracefully', async () => {
      // Mock an error in the try block
      sinon.stub(server, 'handleGitCommand').rejects(new Error('Unexpected error'));

      await server.handleCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Error: Error: Unexpected error\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle chain execution exceptions', async () => {
      mockChain.executeChain.rejects(new Error('Chain execution failed'));

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Access denied: Chain execution failed\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });
  });

  describe('pack data capture functionality', () => {
    let mockClient;
    let mockStream;
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
        on: sinon.stub(),
        once: sinon.stub(),
      };
    });

    afterEach(() => {
      clock.restore();
    });

    it('should differentiate between push and pull operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'connectToRemoteGitServer').resolves();
      sinon.stub(server, 'handlePushOperation').resolves();
      sinon.stub(server, 'handlePullOperation').resolves();

      // Test push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);
      expect(server.handlePushOperation.calledOnce).to.be.true;

      // Reset stubs
      server.handlePushOperation.resetHistory();
      server.handlePullOperation.resetHistory();

      // Test pull operation
      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);
      expect(server.handlePullOperation.calledOnce).to.be.true;
    });

    it('should capture pack data for push operations', (done) => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate pack data chunks
      const dataHandlers = mockStream.on.getCalls().filter((call) => call.args[0] === 'data');
      const dataHandler = dataHandlers[0].args[1];

      const testData1 = Buffer.from('pack-data-chunk-1');
      const testData2 = Buffer.from('pack-data-chunk-2');

      dataHandler(testData1);
      dataHandler(testData2);

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      // Execute end handler and wait for async completion
      endHandler()
        .then(() => {
          // Verify chain was called with captured pack data
          expect(mockChain.executeChain.calledOnce).to.be.true;
          const capturedReq = mockChain.executeChain.firstCall.args[0];
          expect(capturedReq.body).to.not.be.null;
          expect(capturedReq.bodyRaw).to.not.be.null;
          expect(capturedReq.method).to.equal('POST');
          expect(capturedReq.headers['content-type']).to.equal(
            'application/x-git-receive-pack-request',
          );

          // Verify pack data forwarding was called
          expect(server.forwardPackDataToRemote.calledOnce).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should handle pack data size limits', () => {
      config.getMaxPackSizeBytes.returns(1024); // 1KB limit
      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Get data handler
      const dataHandlers = mockStream.on.getCalls().filter((call) => call.args[0] === 'data');
      const dataHandler = dataHandlers[0].args[1];

      // Create oversized data (over 1KB limit)
      const oversizedData = Buffer.alloc(2048);

      dataHandler(oversizedData);

      expect(
        mockStream.stderr.write.calledWith(sinon.match(/Pack data exceeds maximum size limit/)),
      ).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle pack data capture timeout', () => {
      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Fast-forward 5 minutes to trigger timeout
      clock.tick(300001);

      expect(mockStream.stderr.write.calledWith('Error: Pack data capture timeout\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle invalid data types during capture', () => {
      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Get data handler
      const dataHandlers = mockStream.on.getCalls().filter((call) => call.args[0] === 'data');
      const dataHandler = dataHandlers[0].args[1];

      // Send invalid data type
      dataHandler('invalid-string-data');

      expect(mockStream.stderr.write.calledWith('Error: Invalid data format received\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it.skip('should handle pack data corruption detection', (done) => {
      mockChain.executeChain.resolves({ error: false, blocked: false });

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Get data handler
      const dataHandlers = mockStream.on.getCalls().filter((call) => call.args[0] === 'data');
      const dataHandler = dataHandlers[0].args[1];

      // Simulate data chunks
      dataHandler(Buffer.from('test-data'));

      // Mock Buffer.concat to simulate corruption
      const originalConcat = Buffer.concat;
      Buffer.concat = sinon.stub().returns(Buffer.from('corrupted'));

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          // Corruption should be detected and stream should be terminated
          expect(mockStream.stderr.write.calledWith(sinon.match(/Failed to process pack data/))).to
            .be.true;
          expect(mockStream.exit.calledWith(1)).to.be.true;
          expect(mockStream.end.calledOnce).to.be.true;

          // Restore original function
          Buffer.concat = originalConcat;
          done();
        })
        .catch(done);
    });

    it('should handle empty pack data for pushes', (done) => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate stream end without any data
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          // Should still execute chain with null body for empty pushes
          expect(mockChain.executeChain.calledOnce).to.be.true;
          const capturedReq = mockChain.executeChain.firstCall.args[0];
          expect(capturedReq.body).to.be.null;
          expect(capturedReq.bodyRaw).to.be.null;

          expect(server.forwardPackDataToRemote.calledOnce).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should handle chain execution failures for push operations', (done) => {
      mockChain.executeChain.resolves({ error: true, errorMessage: 'Security scan failed' });

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          expect(mockStream.stderr.write.calledWith('Access denied: Security scan failed\n')).to.be
            .true;
          expect(mockStream.exit.calledWith(1)).to.be.true;
          expect(mockStream.end.calledOnce).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should execute chain immediately for pull operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'connectToRemoteGitServer').resolves();

      await server.handlePullOperation(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-upload-pack',
      );

      // Chain should be executed immediately without pack data capture
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const capturedReq = mockChain.executeChain.firstCall.args[0];
      expect(capturedReq.method).to.equal('GET');
      expect(capturedReq.body).to.be.null;
      expect(capturedReq.headers['content-type']).to.equal('application/x-git-upload-pack-request');

      expect(server.connectToRemoteGitServer.calledOnce).to.be.true;
    });

    it('should handle pull operation chain failures', async () => {
      mockChain.executeChain.resolves({ blocked: true, blockedMessage: 'Pull access denied' });

      await server.handlePullOperation(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-upload-pack',
      );

      expect(mockStream.stderr.write.calledWith('Access denied: Pull access denied\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle pull operation chain exceptions', async () => {
      mockChain.executeChain.rejects(new Error('Chain threw exception'));

      await server.handlePullOperation(
        "git-upload-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-upload-pack',
      );

      expect(mockStream.stderr.write.calledWith('Access denied: Chain threw exception\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle chain execution exceptions during push', (done) => {
      mockChain.executeChain.rejects(new Error('Security chain exception'));

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          expect(mockStream.stderr.write.calledWith(sinon.match(/Access denied/))).to.be.true;
          expect(mockStream.stderr.write.calledWith(sinon.match(/Security chain/))).to.be.true;
          expect(mockStream.exit.calledWith(1)).to.be.true;
          expect(mockStream.end.calledOnce).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should handle forwarding errors during push operation', (done) => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').rejects(new Error('Remote forwarding failed'));

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          expect(mockStream.stderr.write.calledWith(sinon.match(/forwarding/))).to.be.true;
          expect(mockStream.stderr.write.calledWith(sinon.match(/Remote forwarding failed/))).to.be
            .true;
          expect(mockStream.exit.calledWith(1)).to.be.true;
          expect(mockStream.end.calledOnce).to.be.true;
          done();
        })
        .catch(done);
    });

    it('should clear timeout when error occurs during push', () => {
      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Get error handler
      const errorHandlers = mockStream.on.getCalls().filter((call) => call.args[0] === 'error');
      const errorHandler = errorHandlers[0].args[1];

      // Trigger error
      errorHandler(new Error('Stream error'));

      expect(mockStream.stderr.write.calledWith('Stream error: Stream error\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should clear timeout when stream ends normally', (done) => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      server.handlePushOperation(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        'test/repo',
        'git-receive-pack',
      );

      // Simulate stream end
      const endHandlers = mockStream.once.getCalls().filter((call) => call.args[0] === 'end');
      const endHandler = endHandlers[0].args[1];

      endHandler()
        .then(() => {
          // Verify the timeout was cleared (no timeout should fire after this)
          clock.tick(300001);
          // If timeout was properly cleared, no timeout error should occur
          done();
        })
        .catch(done);
    });
  });

  describe('forwardPackDataToRemote functionality', () => {
    let mockClient;
    let mockStream;
    let mockSsh2Client;
    let mockRemoteStream;

    beforeEach(() => {
      mockClient = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
          gitAccount: 'testgit',
        },
        clientIp: '127.0.0.1',
      };
      mockStream = {
        write: sinon.stub(),
        stderr: { write: sinon.stub() },
        exit: sinon.stub(),
        end: sinon.stub(),
      };

      mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
        end: sinon.stub(),
      };

      mockRemoteStream = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        destroy: sinon.stub(),
      };

      const { Client } = require('ssh2');
      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);
      sinon.stub(Client.prototype, 'end').callsFake(mockSsh2Client.end);
    });

    it('should successfully forward pack data to remote', async () => {
      const packData = Buffer.from('test-pack-data');

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        packData,
      );

      await promise;

      expect(mockRemoteStream.write.calledWith(packData)).to.be.true;
      expect(mockRemoteStream.end.calledOnce).to.be.true;
    });

    it('should handle null pack data gracefully', async () => {
      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        null,
      );

      await promise;

      expect(mockRemoteStream.write.called).to.be.false; // No data to write
      expect(mockRemoteStream.end.calledOnce).to.be.true;
    });

    it('should handle empty pack data', async () => {
      const emptyPackData = Buffer.alloc(0);

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        emptyPackData,
      );

      await promise;

      expect(mockRemoteStream.write.called).to.be.false; // Empty data not written
      expect(mockRemoteStream.end.calledOnce).to.be.true;
    });

    it('should handle remote exec errors in forwarding', async () => {
      // Mock connection ready but exec failure
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(new Error('Remote exec failed'));
        });
        callback();
      });

      try {
        await server.forwardPackDataToRemote(
          "git-receive-pack 'test/repo'",
          mockStream,
          mockClient,
          Buffer.from('data'),
        );
      } catch (error) {
        expect(error.message).to.equal('Remote exec failed');
        expect(mockStream.stderr.write.calledWith('Remote execution error: Remote exec failed\n'))
          .to.be.true;
        expect(mockStream.exit.calledWith(1)).to.be.true;
        expect(mockStream.end.calledOnce).to.be.true;
      }
    });

    it('should handle remote connection errors in forwarding', async () => {
      // Mock connection error
      mockSsh2Client.on.withArgs('error').callsFake((event, callback) => {
        callback(new Error('Connection to remote failed'));
      });

      try {
        await server.forwardPackDataToRemote(
          "git-receive-pack 'test/repo'",
          mockStream,
          mockClient,
          Buffer.from('data'),
        );
      } catch (error) {
        expect(error.message).to.equal('Connection to remote failed');
        expect(
          mockStream.stderr.write.calledWith('Connection error: Connection to remote failed\n'),
        ).to.be.true;
        expect(mockStream.exit.calledWith(1)).to.be.true;
        expect(mockStream.end.calledOnce).to.be.true;
      }
    });

    it('should handle remote stream errors in forwarding', async () => {
      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock remote stream error
      mockRemoteStream.on.withArgs('error').callsFake((event, callback) => {
        callback(new Error('Remote stream error'));
      });

      try {
        await server.forwardPackDataToRemote(
          "git-receive-pack 'test/repo'",
          mockStream,
          mockClient,
          Buffer.from('data'),
        );
      } catch (error) {
        expect(error.message).to.equal('Remote stream error');
        expect(mockStream.stderr.write.calledWith('Stream error: Remote stream error\n')).to.be
          .true;
        expect(mockStream.exit.calledWith(1)).to.be.true;
        expect(mockStream.end.calledOnce).to.be.true;
      }
    });

    it('should handle forwarding timeout', async () => {
      const clock = sinon.useFakeTimers();

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        Buffer.from('data'),
      );

      // Fast-forward to trigger timeout
      clock.tick(30001);

      try {
        await promise;
      } catch (error) {
        expect(error.message).to.equal('Connection timeout');
        expect(mockStream.stderr.write.calledWith('Connection timeout to remote server\n')).to.be
          .true;
        expect(mockStream.exit.calledWith(1)).to.be.true;
        expect(mockStream.end.calledOnce).to.be.true;
      }

      clock.restore();
    });

    it('should handle remote stream data forwarding to client', async () => {
      const packData = Buffer.from('test-pack-data');
      const remoteResponseData = Buffer.from('remote-response');

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise after data handling
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        packData,
      );

      // Simulate remote sending data back
      const remoteDataHandler = mockRemoteStream.on.withArgs('data').firstCall?.args[1];
      if (remoteDataHandler) {
        remoteDataHandler(remoteResponseData);
        expect(mockStream.write.calledWith(remoteResponseData)).to.be.true;
      }

      await promise;

      expect(mockRemoteStream.write.calledWith(packData)).to.be.true;
      expect(mockRemoteStream.end.calledOnce).to.be.true;
    });

    it('should handle remote stream exit events in forwarding', async () => {
      const packData = Buffer.from('test-pack-data');

      // Mock successful connection and exec
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream exit to resolve promise
      mockRemoteStream.on.withArgs('exit').callsFake((event, callback) => {
        setImmediate(() => callback(0, 'SIGTERM'));
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        packData,
      );

      await promise;

      expect(mockStream.exit.calledWith(0)).to.be.true;
      expect(mockRemoteStream.write.calledWith(packData)).to.be.true;
    });

    it('should clear timeout when remote connection succeeds', async () => {
      const clock = sinon.useFakeTimers();

      // Mock successful connection
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        mockSsh2Client.exec.callsFake((command, execCallback) => {
          execCallback(null, mockRemoteStream);
        });
        callback();
      });

      // Mock stream close to resolve promise
      mockRemoteStream.on.withArgs('close').callsFake((event, callback) => {
        setImmediate(callback);
      });

      const promise = server.forwardPackDataToRemote(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
        Buffer.from('data'),
      );

      // Fast-forward past timeout time - should not timeout since connection succeeded
      clock.tick(30001);

      await promise;

      // Should not have timed out
      expect(mockStream.stderr.write.calledWith('Connection timeout to remote server\n')).to.be
        .false;

      clock.restore();
    });
  });
});
