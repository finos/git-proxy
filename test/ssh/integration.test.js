const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const fs = require('fs');
const ssh2 = require('ssh2');
const config = require('../../src/config');
const db = require('../../src/db');
const chain = require('../../src/proxy/chain');
const { MEGABYTE } = require('../../src/constants');
const SSHServer = require('../../src/proxy/ssh/server').default;

describe('SSH Pack Data Capture Integration Tests', () => {
  let server;
  let mockConfig;
  let mockDb;
  let mockChain;
  let mockClient;
  let mockStream;

  beforeEach(() => {
    // Create comprehensive mocks
    mockConfig = {
      getSSHConfig: sinon.stub().returns({
        hostKey: {
          privateKeyPath: 'test/keys/test_key',
          publicKeyPath: 'test/keys/test_key.pub',
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

    // Stub dependencies
    sinon.stub(config, 'getSSHConfig').callsFake(mockConfig.getSSHConfig);
    sinon.stub(config, 'getMaxPackSizeBytes').returns(500 * MEGABYTE);
    sinon.stub(db, 'findUserBySSHKey').callsFake(mockDb.findUserBySSHKey);
    sinon.stub(db, 'findUser').callsFake(mockDb.findUser);
    sinon.stub(chain.default, 'executeChain').callsFake(mockChain.executeChain);
    sinon.stub(fs, 'readFileSync').returns(Buffer.from('mock-key'));
    sinon.stub(ssh2, 'Server').returns({
      listen: sinon.stub(),
      close: sinon.stub(),
      on: sinon.stub(),
    });

    server = new SSHServer();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('End-to-End Push Operation with Security Scanning', () => {
    it('should capture pack data, run security chain, and forward on success', async () => {
      // Configure security chain to pass
      mockChain.executeChain.resolves({ error: false, blocked: false });

      // Mock forwardPackDataToRemote to succeed
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Simulate push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Verify handlePushOperation was called (not handlePullOperation)
      expect(mockStream.on.calledWith('data')).to.be.true;
      expect(mockStream.once.calledWith('end')).to.be.true;
    });

    it('should capture pack data, run security chain, and block on security failure', async () => {
      // Configure security chain to fail
      mockChain.executeChain.resolves({
        error: true,
        errorMessage: 'Secret detected in commit',
      });

      // Simulate pack data capture and chain execution
      const promise = server.handleGitCommand(
        "git-receive-pack 'test/repo'",
        mockStream,
        mockClient,
      );

      // Simulate receiving pack data
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('pack-data-with-secrets'));
      }

      // Simulate stream end to trigger chain execution
      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      await promise;

      // Verify security chain was called with pack data
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const capturedReq = mockChain.executeChain.firstCall.args[0];
      expect(capturedReq.body).to.not.be.null;
      expect(capturedReq.method).to.equal('POST');

      // Verify push was blocked
      expect(mockStream.stderr.write.calledWith('Access denied: Secret detected in commit\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });

    it('should handle large pack data within limits', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate large but acceptable pack data (100MB)
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        const largePack = Buffer.alloc(100 * MEGABYTE, 'pack-data');
        dataHandler(largePack);
      }

      // Should not error on size
      expect(
        mockStream.stderr.write.calledWith(sinon.match(/Pack data exceeds maximum size limit/)),
      ).to.be.false;
    });

    it('should reject oversized pack data', async () => {
      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate oversized pack data (600MB)
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        const oversizedPack = Buffer.alloc(600 * MEGABYTE, 'oversized-pack');
        dataHandler(oversizedPack);
      }

      // Should error on size limit
      expect(
        mockStream.stderr.write.calledWith(sinon.match(/Pack data exceeds maximum size limit/)),
      ).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });
  });

  describe('End-to-End Pull Operation', () => {
    it('should execute security chain immediately for pull operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'connectToRemoteGitServer').resolves();

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      // Verify chain was executed immediately (no pack data capture)
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const capturedReq = mockChain.executeChain.firstCall.args[0];
      expect(capturedReq.method).to.equal('GET');
      expect(capturedReq.body).to.be.null;

      expect(server.connectToRemoteGitServer.calledOnce).to.be.true;
    });

    it('should block pull operations when security chain fails', async () => {
      mockChain.executeChain.resolves({
        blocked: true,
        blockedMessage: 'Repository access denied',
      });

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Access denied: Repository access denied\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle stream errors gracefully during pack capture', async () => {
      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate stream error
      const errorHandler = mockStream.on.withArgs('error').firstCall?.args[1];
      if (errorHandler) {
        errorHandler(new Error('Stream connection lost'));
      }

      expect(mockStream.stderr.write.calledWith('Stream error: Stream connection lost\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });

    it('should timeout stalled pack data capture', async () => {
      const clock = sinon.useFakeTimers();

      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Fast-forward past timeout
      clock.tick(300001); // 5 minutes + 1ms

      expect(mockStream.stderr.write.calledWith('Error: Pack data capture timeout\n')).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;

      clock.restore();
    });

    it('should handle invalid command formats', async () => {
      await server.handleGitCommand('invalid-git-command format', mockStream, mockClient);

      expect(mockStream.stderr.write.calledWith('Error: Error: Invalid Git command format\n')).to.be
        .true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });
  });

  describe('Request Object Construction', () => {
    it('should construct proper request object for push operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate pack data
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('test-pack-data'));
      }

      // Trigger end
      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      // Verify request object structure
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const req = mockChain.executeChain.firstCall.args[0];

      expect(req.originalUrl).to.equal('/test/repo/git-receive-pack');
      expect(req.method).to.equal('POST');
      expect(req.headers['content-type']).to.equal('application/x-git-receive-pack-request');
      expect(req.body).to.not.be.null;
      expect(req.bodyRaw).to.not.be.null;
      expect(req.isSSH).to.be.true;
      expect(req.protocol).to.equal('ssh');
      expect(req.sshUser).to.deep.equal({
        username: 'test-user',
        email: 'test@example.com',
        gitAccount: 'testgit',
        sshKeyInfo: {
          keyType: 'ssh-rsa',
          keyData: Buffer.from('test-key-data'),
        },
      });
    });

    it('should construct proper request object for pull operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'connectToRemoteGitServer').resolves();

      await server.handleGitCommand("git-upload-pack 'test/repo'", mockStream, mockClient);

      // Verify request object structure for pulls
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const req = mockChain.executeChain.firstCall.args[0];

      expect(req.originalUrl).to.equal('/test/repo/git-upload-pack');
      expect(req.method).to.equal('GET');
      expect(req.headers['content-type']).to.equal('application/x-git-upload-pack-request');
      expect(req.body).to.be.null;
      expect(req.isSSH).to.be.true;
      expect(req.protocol).to.equal('ssh');
    });
  });

  describe('Pack Data Integrity', () => {
    it('should detect pack data corruption', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });

      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate pack data
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('test-pack-data'));
      }

      // Mock Buffer.concat to simulate corruption
      const originalConcat = Buffer.concat;
      Buffer.concat = sinon.stub().returns(Buffer.from('corrupted-different-size'));

      try {
        // Trigger end
        const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
        if (endHandler) {
          await endHandler();
        }

        expect(mockStream.stderr.write.calledWith(sinon.match(/Failed to process pack data/))).to.be
          .true;
        expect(mockStream.exit.calledWith(1)).to.be.true;
      } finally {
        // Always restore
        Buffer.concat = originalConcat;
      }
    });

    it('should handle empty push operations', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      // Start push operation
      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Trigger end without any data (empty push)
      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      // Should still execute chain with null body
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const req = mockChain.executeChain.firstCall.args[0];
      expect(req.body).to.be.null;
      expect(req.bodyRaw).to.be.null;

      expect(server.forwardPackDataToRemote.calledOnce).to.be.true;
    });
  });

  describe('Security Chain Integration', () => {
    it('should pass SSH context to security processors', async () => {
      mockChain.executeChain.resolves({ error: false, blocked: false });
      sinon.stub(server, 'forwardPackDataToRemote').resolves();

      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate pack data and end
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('pack-data'));
      }

      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      // Verify SSH context is passed to chain
      expect(mockChain.executeChain.calledOnce).to.be.true;
      const req = mockChain.executeChain.firstCall.args[0];
      expect(req.isSSH).to.be.true;
      expect(req.protocol).to.equal('ssh');
      expect(req.user).to.deep.equal(mockClient.authenticatedUser);
      expect(req.sshUser.username).to.equal('test-user');
    });

    it('should handle blocked pushes with custom message', async () => {
      mockChain.executeChain.resolves({
        blocked: true,
        blockedMessage: 'Gitleaks found API key in commit abc123',
      });

      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate pack data and end
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('pack-with-secrets'));
      }

      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      expect(
        mockStream.stderr.write.calledWith(
          'Access denied: Gitleaks found API key in commit abc123\n',
        ),
      ).to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });

    it('should handle chain errors with fallback message', async () => {
      mockChain.executeChain.resolves({
        error: true,
        // No errorMessage provided
      });

      await server.handleGitCommand("git-receive-pack 'test/repo'", mockStream, mockClient);

      // Simulate pack data and end
      const dataHandler = mockStream.on.withArgs('data').firstCall?.args[1];
      if (dataHandler) {
        dataHandler(Buffer.from('pack-data'));
      }

      const endHandler = mockStream.once.withArgs('end').firstCall?.args[1];
      if (endHandler) {
        await endHandler();
      }

      expect(mockStream.stderr.write.calledWith('Access denied: Request blocked by proxy chain\n'))
        .to.be.true;
      expect(mockStream.exit.calledWith(1)).to.be.true;
    });
  });
});
