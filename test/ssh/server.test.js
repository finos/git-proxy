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
      getProxyUrl: sinon.stub().returns('https://github.com'),
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
    sinon.stub(config, 'getProxyUrl').callsFake(mockConfig.getProxyUrl);
    sinon.stub(db, 'findUserBySSHKey').callsFake(mockDb.findUserBySSHKey);
    sinon.stub(db, 'findUser').callsFake(mockDb.findUser);
    sinon.stub(chain, 'executeChain').callsFake(mockChain.executeChain);
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
      expect(serverConfig.keepaliveInterval).to.equal(5000);
      expect(serverConfig.keepaliveCountMax).to.equal(10);
      expect(serverConfig.readyTimeout).to.equal(30000);
      expect(serverConfig.debug).to.be.a('function');
      // Check that a connection handler is provided
      expect(ssh2.Server.firstCall.args[1]).to.be.a('function');
    });

    it('should enable debug logging when SSH_DEBUG is true', () => {
      const originalEnv = process.env.SSH_DEBUG;
      process.env.SSH_DEBUG = 'true';

      // Create a new server to test debug logging
      new SSHServer();
      const serverConfig = ssh2.Server.lastCall.args[0];

      // Test debug function
      const consoleSpy = sinon.spy(console, 'debug');
      serverConfig.debug('test debug message');
      expect(consoleSpy.calledWith('[SSH Debug]', 'test debug message')).to.be.true;

      consoleSpy.restore();
      process.env.SSH_DEBUG = originalEnv;
    });

    it('should disable debug logging when SSH_DEBUG is false', () => {
      const originalEnv = process.env.SSH_DEBUG;
      process.env.SSH_DEBUG = 'false';

      // Create a new server to test debug logging
      new SSHServer();
      const serverConfig = ssh2.Server.lastCall.args[0];

      // Test debug function
      const consoleSpy = sinon.spy(console, 'debug');
      serverConfig.debug('test debug message');
      expect(consoleSpy.called).to.be.false;

      consoleSpy.restore();
      process.env.SSH_DEBUG = originalEnv;
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
        userPrivateKey: null,
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

      errorHandler(new Error('Test error'));
      expect(mockClient.end.calledOnce).to.be.true;
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
        expect(mockClient.userPrivateKey).to.deep.equal({
          keyType: 'ssh-rsa',
          keyData: Buffer.from('mock-key-data'),
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
      // Mock a method that will throw
      sinon.stub(server, 'handleGitCommand').throws(new Error('General error'));

      await server.handleCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Error: General error\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });
  });

  describe('handleGitCommand', () => {
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

    it('should handle invalid git command format', async () => {
      await server.handleGitCommand('invalid-command', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Error: Invalid Git command format\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });

    it('should handle missing proxy URL configuration', async () => {
      mockConfig.getProxyUrl.returns(null);

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Configuration error: No proxy URL configured\n'))
        .to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
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

    it('should handle missing proxy URL', async () => {
      mockConfig.getProxyUrl.returns(null);

      try {
        await server.connectToRemoteGitServer(
          "git-upload-pack 'test/repo'",
          mockStream,
          mockClient,
        );
      } catch (error) {
        expect(error.message).to.equal('No proxy URL configured');
      }
    });

    it('should handle connection timeout', async () => {
      // Mock the SSH client for remote connection
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
      // Mock the SSH client for remote connection
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
      // Mock the SSH client for remote connection
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
  });
});
