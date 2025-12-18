import { describe, it, beforeEach, afterEach, beforeAll, afterAll, expect, vi } from 'vitest';
import fs from 'fs';
import { execSync } from 'child_process';
import * as config from '../../src/config';
import * as db from '../../src/db';
import * as chain from '../../src/proxy/chain';
import SSHServer from '../../src/proxy/ssh/server';
import * as GitProtocol from '../../src/proxy/ssh/GitProtocol';

/**
 * SSH Server Unit Test Suite
 *
 * Comprehensive tests for SSHServer class covering:
 * - Server lifecycle (start/stop)
 * - Client connection handling
 * - Authentication (publickey, password, global requests)
 * - Command handling and validation
 * - Security chain integration
 * - Error handling
 * - Git protocol operations (push/pull)
 */

describe('SSHServer', () => {
  let server: SSHServer;
  const testKeysDir = 'test/keys';
  let testKeyContent: Buffer;

  beforeAll(() => {
    // Create directory for test keys
    if (!fs.existsSync(testKeysDir)) {
      fs.mkdirSync(testKeysDir, { recursive: true });
    }

    // Generate test SSH key pair in PEM format (ssh2 library requires PEM, not OpenSSH format)
    try {
      execSync(
        `ssh-keygen -t rsa -b 2048 -m PEM -f ${testKeysDir}/test_key -N "" -C "test@git-proxy"`,
        { timeout: 5000 },
      );
      testKeyContent = fs.readFileSync(`${testKeysDir}/test_key`);
    } catch (error) {
      // If key generation fails, create a mock key file
      testKeyContent = Buffer.from(
        '-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END RSA PRIVATE KEY-----',
      );
      fs.writeFileSync(`${testKeysDir}/test_key`, testKeyContent);
      fs.writeFileSync(`${testKeysDir}/test_key.pub`, 'ssh-rsa MOCK_PUBLIC_KEY test@git-proxy');
    }
  });

  afterAll(() => {
    // Clean up test keys
    if (fs.existsSync(testKeysDir)) {
      fs.rmSync(testKeysDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Mock SSH configuration to prevent process.exit
    vi.spyOn(config, 'getSSHConfig').mockReturnValue({
      hostKey: {
        privateKeyPath: `${testKeysDir}/test_key`,
        publicKeyPath: `${testKeysDir}/test_key.pub`,
      },
      port: 2222,
      enabled: true,
    } as any);

    vi.spyOn(config, 'getMaxPackSizeBytes').mockReturnValue(500 * 1024 * 1024);

    // Create a new server instance for each test
    server = new SSHServer();
  });

  afterEach(() => {
    // Clean up server
    try {
      server.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
    vi.restoreAllMocks();
  });

  describe('Server Lifecycle', () => {
    it('should start listening on configured port', () => {
      const startSpy = vi.spyOn((server as any).server, 'listen').mockImplementation(() => {});
      server.start();
      expect(startSpy).toHaveBeenCalled();
      const callArgs = startSpy.mock.calls[0];
      expect(callArgs[0]).toBe(2222);
      expect(callArgs[1]).toBe('0.0.0.0');
    });

    it('should start listening on default port 2222 when not configured', () => {
      vi.spyOn(config, 'getSSHConfig').mockReturnValue({
        hostKey: {
          privateKeyPath: `${testKeysDir}/test_key`,
          publicKeyPath: `${testKeysDir}/test_key.pub`,
        },
        port: null,
      } as any);

      const testServer = new SSHServer();
      const startSpy = vi.spyOn((testServer as any).server, 'listen').mockImplementation(() => {});
      testServer.start();
      expect(startSpy).toHaveBeenCalled();
      const callArgs = startSpy.mock.calls[0];
      expect(callArgs[0]).toBe(2222);
      expect(callArgs[1]).toBe('0.0.0.0');
    });

    it('should stop the server', () => {
      const closeSpy = vi.spyOn((server as any).server, 'close');
      server.stop();
      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('should handle stop when server is null', () => {
      const testServer = new SSHServer();
      (testServer as any).server = null;
      expect(() => testServer.stop()).not.toThrow();
    });
  });

  describe('Client Connection Handling', () => {
    let mockClient: any;
    let clientInfo: any;

    beforeEach(() => {
      mockClient = {
        on: vi.fn(),
        end: vi.fn(),
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
      (server as any).handleClient(mockClient, clientInfo);
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('end', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('authentication', expect.any(Function));
    });

    it('should set client IP from clientInfo', () => {
      (server as any).handleClient(mockClient, clientInfo);
      expect(mockClient.clientIp).toBe('127.0.0.1');
    });

    it('should set client IP to unknown when not provided', () => {
      (server as any).handleClient(mockClient, {});
      expect(mockClient.clientIp).toBe('unknown');
    });

    it('should handle client error events without throwing', () => {
      (server as any).handleClient(mockClient, clientInfo);
      const errorHandler = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];

      expect(() => errorHandler(new Error('Test error'))).not.toThrow();
    });
  });

  describe('Authentication - Public Key', () => {
    let mockClient: any;
    let clientInfo: any;

    beforeEach(() => {
      mockClient = {
        on: vi.fn(),
        end: vi.fn(),
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

    it('should accept publickey authentication with valid key', async () => {
      const mockCtx = {
        method: 'publickey',
        key: {
          algo: 'ssh-rsa',
          data: Buffer.from('mock-key-data'),
          comment: 'test-key',
        },
        accept: vi.fn(),
        reject: vi.fn(),
      };

      const mockUser = {
        username: 'test-user',
        email: 'test@example.com',
        gitAccount: 'testgit',
        password: 'hashed-password',
        admin: false,
      };

      vi.spyOn(db, 'findUserBySSHKey').mockResolvedValue(mockUser as any);

      (server as any).handleClient(mockClient, clientInfo);
      const authHandler = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'authentication',
      )?.[1];

      await authHandler(mockCtx);

      expect(db.findUserBySSHKey).toHaveBeenCalled();
      expect(mockCtx.accept).toHaveBeenCalled();
      expect(mockClient.authenticatedUser).toBeDefined();
    });

    it('should reject publickey authentication with invalid key', async () => {
      const mockCtx = {
        method: 'publickey',
        key: {
          algo: 'ssh-rsa',
          data: Buffer.from('invalid-key'),
          comment: 'test-key',
        },
        accept: vi.fn(),
        reject: vi.fn(),
      };

      vi.spyOn(db, 'findUserBySSHKey').mockResolvedValue(null);

      (server as any).handleClient(mockClient, clientInfo);
      const authHandler = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'authentication',
      )?.[1];

      await authHandler(mockCtx);

      expect(db.findUserBySSHKey).toHaveBeenCalled();
      expect(mockCtx.reject).toHaveBeenCalled();
      expect(mockCtx.accept).not.toHaveBeenCalled();
    });
  });

  describe('Authentication - Global Requests', () => {
    let mockClient: any;
    let clientInfo: any;

    beforeEach(() => {
      mockClient = {
        on: vi.fn(),
        end: vi.fn(),
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

    it('should accept keepalive@openssh.com requests', () => {
      (server as any).handleClient(mockClient, clientInfo);
      const globalRequestHandler = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'global request',
      )?.[1];

      const accept = vi.fn();
      const reject = vi.fn();
      const info = { type: 'keepalive@openssh.com' };

      globalRequestHandler(accept, reject, info);
      expect(accept).toHaveBeenCalledOnce();
      expect(reject).not.toHaveBeenCalled();
    });

    it('should reject non-keepalive global requests', () => {
      (server as any).handleClient(mockClient, clientInfo);
      const globalRequestHandler = mockClient.on.mock.calls.find(
        (call: any[]) => call[0] === 'global request',
      )?.[1];

      const accept = vi.fn();
      const reject = vi.fn();
      const info = { type: 'other-request' };

      globalRequestHandler(accept, reject, info);
      expect(reject).toHaveBeenCalledOnce();
      expect(accept).not.toHaveBeenCalled();
    });
  });

  describe('Command Handling - Authentication', () => {
    let mockStream: any;
    let mockClient: any;

    beforeEach(() => {
      mockStream = {
        write: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
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
    });

    it('should reject commands from unauthenticated clients', async () => {
      const unauthenticatedClient = {
        authenticatedUser: null,
        clientIp: '127.0.0.1',
      };

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        unauthenticatedClient as any,
      );

      expect(mockStream.stderr.write).toHaveBeenCalledWith('Authentication required\n');
      expect(mockStream.exit).toHaveBeenCalledWith(1);
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should accept commands from authenticated clients', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(mockStream.stderr.write).not.toHaveBeenCalledWith('Authentication required\n');
    });
  });

  describe('Command Handling - Validation', () => {
    let mockStream: any;
    let mockClient: any;

    beforeEach(() => {
      mockStream = {
        write: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
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
    });

    it('should accept git-upload-pack commands', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(chain.default.executeChain).toHaveBeenCalled();
    });

    it('should accept git-receive-pack commands', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'forwardPackDataToRemote').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-receive-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      // Command is accepted without errors
      expect(mockStream.stderr.write).not.toHaveBeenCalledWith(
        expect.stringContaining('Unsupported'),
      );
    });

    it('should reject non-git commands', async () => {
      await server.handleCommand('ls -la', mockStream, mockClient);

      expect(mockStream.stderr.write).toHaveBeenCalledWith('Unsupported command: ls -la\n');
      expect(mockStream.exit).toHaveBeenCalledWith(1);
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should reject shell commands', async () => {
      await server.handleCommand('bash', mockStream, mockClient);

      expect(mockStream.stderr.write).toHaveBeenCalledWith('Unsupported command: bash\n');
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Security Chain Integration', () => {
    let mockStream: any;
    let mockClient: any;

    beforeEach(() => {
      mockStream = {
        write: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
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
    });

    it('should execute security chain for pull operations', async () => {
      const chainSpy = vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/org/repo.git'",
        mockStream,
        mockClient,
      );

      expect(chainSpy).toHaveBeenCalledOnce();
      const request = chainSpy.mock.calls[0][0];
      expect(request.method).toBe('GET');
      expect(request.isSSH).toBe(true);
      expect(request.protocol).toBe('ssh');
    });

    it('should block operations when security chain fails', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: true,
        errorMessage: 'Repository access denied',
      } as any);

      await server.handleCommand(
        "git-upload-pack 'github.com/blocked/repo.git'",
        mockStream,
        mockClient,
      );

      expect(mockStream.stderr.write).toHaveBeenCalledWith(
        'Access denied: Repository access denied\n',
      );
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });

    it('should block operations when security chain blocks', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        blocked: true,
        blockedMessage: 'Access denied by policy',
      } as any);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(mockStream.stderr.write).toHaveBeenCalledWith(
        'Access denied: Access denied by policy\n',
      );
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });

    it('should pass SSH user context to security chain', async () => {
      const chainSpy = vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(chainSpy).toHaveBeenCalled();
      const request = chainSpy.mock.calls[0][0];
      expect(request.user).toEqual(mockClient.authenticatedUser);
      expect(request.sshUser).toBeDefined();
      expect(request.sshUser.username).toBe('test-user');
    });
  });

  describe('Error Handling', () => {
    let mockStream: any;
    let mockClient: any;

    beforeEach(() => {
      mockStream = {
        write: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
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
    });

    it('should handle invalid git command format', async () => {
      await server.handleCommand('git-upload-pack invalid-format', mockStream, mockClient);

      expect(mockStream.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Error:'));
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });

    it('should handle security chain errors gracefully', async () => {
      vi.spyOn(chain.default, 'executeChain').mockRejectedValue(new Error('Chain error'));

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(mockStream.stderr.write).toHaveBeenCalled();
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });

    it('should handle protocol errors gracefully', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockRejectedValue(
        new Error('Connection failed'),
      );

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(mockStream.stderr.write).toHaveBeenCalled();
      expect(mockStream.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Git Protocol - Pull Operations', () => {
    let mockStream: any;
    let mockClient: any;

    beforeEach(() => {
      mockStream = {
        write: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
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
    });

    it('should execute security chain immediately for pulls', async () => {
      const chainSpy = vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      vi.spyOn(GitProtocol, 'connectToRemoteGitServer').mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      // Should execute chain immediately without waiting for data
      expect(chainSpy).toHaveBeenCalled();
      const request = chainSpy.mock.calls[0][0];
      expect(request.method).toBe('GET');
      expect(request.body).toBeNull();
    });

    it('should connect to remote server after security check passes', async () => {
      vi.spyOn(chain.default, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as any);
      const connectSpy = vi
        .spyOn(GitProtocol, 'connectToRemoteGitServer')
        .mockResolvedValue(undefined);

      await server.handleCommand(
        "git-upload-pack 'github.com/test/repo.git'",
        mockStream,
        mockClient,
      );

      expect(connectSpy).toHaveBeenCalled();
    });
  });
});
