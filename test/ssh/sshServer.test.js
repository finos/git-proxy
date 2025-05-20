const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const fs = require('fs');
const ssh2 = require('ssh2');
const config = require('../../src/config');
const db = require('../../src/db');
const chain = require('../../src/proxy/chain');
const SSHServer = require('../../src/proxy/ssh/server');
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
    // Generate test SSH key pair
    execSync(`ssh-keygen -t rsa -b 4096 -f ${testKeysDir}/test_key -N "" -C "test@git-proxy"`);
    // Read the key once and store it
    testKeyContent = fs.readFileSync(`${testKeysDir}/test_key`);
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
        port: 22,
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
      expect(serverConfig.authMethods).to.deep.equal(['publickey', 'password']);
      expect(serverConfig.keepaliveInterval).to.equal(20000);
      expect(serverConfig.keepaliveCountMax).to.equal(5);
      expect(serverConfig.readyTimeout).to.equal(30000);
    });
  });

  describe('start', () => {
    it('should start listening on the configured port', () => {
      server.start();
      expect(server.server.listen.calledWith(22, '0.0.0.0')).to.be.true;
    });
  });

  describe('handleClient', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        on: sinon.stub(),
        username: null,
        userPrivateKey: null,
      };
    });

    it('should set up client event handlers', () => {
      server.handleClient(mockClient);
      expect(mockClient.on.calledWith('error')).to.be.true;
      expect(mockClient.on.calledWith('end')).to.be.true;
      expect(mockClient.on.calledWith('close')).to.be.true;
      expect(mockClient.on.calledWith('global request')).to.be.true;
      expect(mockClient.on.calledWith('ready')).to.be.true;
      expect(mockClient.on.calledWith('authentication')).to.be.true;
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

        mockDb.findUserBySSHKey.resolves({ username: 'test-user' });

        server.handleClient(mockClient);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUserBySSHKey.calledOnce).to.be.true;
        expect(mockCtx.accept.calledOnce).to.be.true;
        expect(mockClient.username).to.equal('test-user');
        expect(mockClient.userPrivateKey).to.deep.equal(mockCtx.key);
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
        });

        const bcrypt = require('bcryptjs');
        sinon.stub(bcrypt, 'compare').resolves(true);

        server.handleClient(mockClient);
        const authHandler = mockClient.on.withArgs('authentication').firstCall.args[1];
        await authHandler(mockCtx);

        expect(mockDb.findUser.calledWith('test-user')).to.be.true;
        expect(bcrypt.compare.calledWith('test-password', '$2a$10$mockHash')).to.be.true;
        expect(mockCtx.accept.calledOnce).to.be.true;
      });
    });
  });

  describe('handleSession', () => {
    let mockSession;
    let mockStream;
    let mockAccept;
    let mockReject;

    beforeEach(() => {
      mockStream = {
        write: sinon.stub(),
        end: sinon.stub(),
        exit: sinon.stub(),
        on: sinon.stub(),
      };

      mockSession = {
        on: sinon.stub(),
        _channel: {
          _client: {
            userPrivateKey: null,
          },
        },
      };

      mockAccept = sinon.stub().returns(mockSession);
      mockReject = sinon.stub();
    });

    it('should handle git-upload-pack command', async () => {
      const mockInfo = {
        command: "git-upload-pack 'test/repo'",
      };

      mockChain.executeChain.resolves({
        error: false,
        blocked: false,
      });

      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
      };

      // Mock the SSH client constructor
      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);

      // Mock the ready event
      mockSsh2Client.on.withArgs('ready').callsFake((event, callback) => {
        callback();
      });

      // Mock the exec response
      mockSsh2Client.exec.callsFake((command, options, callback) => {
        const mockStream = {
          on: sinon.stub(),
          write: sinon.stub(),
          end: sinon.stub(),
        };
        callback(null, mockStream);
      });

      server.handleSession(mockAccept, mockReject);
      const execHandler = mockSession.on.withArgs('exec').firstCall.args[1];
      await execHandler(mockAccept, mockReject, mockInfo);

      expect(
        mockChain.executeChain.calledWith({
          method: 'GET',
          originalUrl: " 'test/repo",
          isSSH: true,
          headers: {
            'user-agent': 'git/2.0.0',
            'content-type': undefined,
          },
        }),
      ).to.be.true;
    });

    it('should handle git-receive-pack command', async () => {
      const mockInfo = {
        command: "git-receive-pack 'test/repo'",
      };

      mockChain.executeChain.resolves({
        error: false,
        blocked: false,
      });

      const { Client } = require('ssh2');
      const mockSsh2Client = {
        on: sinon.stub(),
        connect: sinon.stub(),
        exec: sinon.stub(),
      };
      sinon.stub(Client.prototype, 'on').callsFake(mockSsh2Client.on);
      sinon.stub(Client.prototype, 'connect').callsFake(mockSsh2Client.connect);
      sinon.stub(Client.prototype, 'exec').callsFake(mockSsh2Client.exec);

      server.handleSession(mockAccept, mockReject);
      const execHandler = mockSession.on.withArgs('exec').firstCall.args[1];
      await execHandler(mockAccept, mockReject, mockInfo);

      expect(
        mockChain.executeChain.calledWith({
          method: 'POST',
          originalUrl: " 'test/repo",
          isSSH: true,
          headers: {
            'user-agent': 'git/2.0.0',
            'content-type': 'application/x-git-receive-pack-request',
          },
        }),
      ).to.be.true;
    });

    it('should handle unsupported commands', async () => {
      const mockInfo = {
        command: 'unsupported-command',
      };

      // Mock the stream that accept() returns
      mockStream = {
        write: sinon.stub(),
        end: sinon.stub(),
      };

      // Mock the session
      const mockSession = {
        on: sinon.stub(),
      };

      // Set up the exec handler
      mockSession.on.withArgs('exec').callsFake((event, handler) => {
        // First accept call returns the session
        // const sessionAccept = () => mockSession;
        // Second accept call returns the stream
        const streamAccept = () => mockStream;
        handler(streamAccept, mockReject, mockInfo);
      });

      // Update mockAccept to return our mock session
      mockAccept = sinon.stub().returns(mockSession);

      server.handleSession(mockAccept, mockReject);

      expect(mockStream.write.calledWith('Unsupported command')).to.be.true;
      expect(mockStream.end.calledOnce).to.be.true;
    });
  });
});
