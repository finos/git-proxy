import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAgentSocketPath,
  convertToSSHUrl,
  createKnownHostsFile,
  createMockResponse,
  validateSSHPrerequisites,
  createSSHConnectionOptions,
} from '../../src/proxy/ssh/sshHelpers';
import { DEFAULT_KNOWN_HOSTS } from '../../src/proxy/ssh/knownHosts';
import { ClientWithUser } from '../../src/proxy/ssh/types';

// Mock child_process and fs
const { childProcessStub, fsStub } = vi.hoisted(() => {
  return {
    childProcessStub: {
      execSync: vi.fn(),
    },
    fsStub: {
      promises: {
        writeFile: vi.fn(),
      },
    },
  };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execSync: childProcessStub.execSync,
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: fsStub.promises.writeFile,
    },
    default: actual,
  };
});

describe('sshHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAgentSocketPath', () => {
    it('should accept valid absolute Unix socket path', () => {
      const validPath = '/tmp/ssh-agent.sock';
      const result = validateAgentSocketPath(validPath);
      expect(result).toBe(validPath);
    });

    it('should accept path with common socket patterns', () => {
      const validPath = '/tmp/ssh-ABCD1234/agent.123';
      const result = validateAgentSocketPath(validPath);
      expect(result).toBe(validPath);
    });

    it('should throw error for undefined socket path', () => {
      expect(() => {
        validateAgentSocketPath(undefined);
      }).toThrow('SSH agent socket path not found');
    });

    it('should throw error for socket path with unsafe characters', () => {
      const unsafePath = '/tmp/agent;rm -rf /';
      expect(() => {
        validateAgentSocketPath(unsafePath);
      }).toThrow('Invalid SSH agent socket path: contains unsafe characters');
    });

    it('should throw error for relative socket path', () => {
      const relativePath = 'tmp/agent.sock';
      expect(() => {
        validateAgentSocketPath(relativePath);
      }).toThrow('Invalid SSH agent socket path: must be an absolute path');
    });
  });

  describe('convertToSSHUrl', () => {
    it('should convert HTTPS URL to SSH URL', () => {
      const httpsUrl = 'https://github.com/org/repo.git';
      const sshUrl = convertToSSHUrl(httpsUrl);
      expect(sshUrl).toBe('git@github.com:org/repo.git');
    });

    it('should convert HTTPS URL with subdirectories to SSH URL', () => {
      const httpsUrl = 'https://gitlab.com/group/subgroup/repo.git';
      const sshUrl = convertToSSHUrl(httpsUrl);
      expect(sshUrl).toBe('git@gitlab.com:group/subgroup/repo.git');
    });

    it('should throw error for invalid URL format', () => {
      const invalidUrl = 'not-a-valid-url';
      expect(() => {
        convertToSSHUrl(invalidUrl);
      }).toThrow('Invalid repository URL');
    });

    it('should handle URLs without .git extension', () => {
      const httpsUrl = 'https://github.com/org/repo';
      const sshUrl = convertToSSHUrl(httpsUrl);
      expect(sshUrl).toBe('git@github.com:org/repo');
    });
  });

  describe('createKnownHostsFile', () => {
    beforeEach(() => {
      fsStub.promises.writeFile.mockResolvedValue(undefined);
    });

    it('should create known_hosts file with verified GitHub key', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@github.com:org/repo.git';

      // Mock execSync to return GitHub's ed25519 key
      childProcessStub.execSync.mockReturnValue(
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n',
      );

      const knownHostsPath = await createKnownHostsFile(tempDir, sshUrl);

      expect(knownHostsPath).toBe('/tmp/test-dir/known_hosts');
      expect(childProcessStub.execSync).toHaveBeenCalledWith(
        'ssh-keyscan -t ed25519 github.com 2>/dev/null',
        expect.objectContaining({
          encoding: 'utf-8',
          timeout: 5000,
        }),
      );
      expect(fsStub.promises.writeFile).toHaveBeenCalledWith(
        '/tmp/test-dir/known_hosts',
        expect.stringContaining('github.com ssh-ed25519'),
        { mode: 0o600 },
      );
    });

    it('should create known_hosts file with verified GitLab key', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@gitlab.com:org/repo.git';

      childProcessStub.execSync.mockReturnValue(
        'gitlab.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf\n',
      );

      const knownHostsPath = await createKnownHostsFile(tempDir, sshUrl);

      expect(knownHostsPath).toBe('/tmp/test-dir/known_hosts');
      expect(childProcessStub.execSync).toHaveBeenCalledWith(
        'ssh-keyscan -t ed25519 gitlab.com 2>/dev/null',
        expect.anything(),
      );
    });

    it('should throw error for invalid SSH URL format', async () => {
      const tempDir = '/tmp/test-dir';
      const invalidUrl = 'not-a-valid-ssh-url';

      await expect(createKnownHostsFile(tempDir, invalidUrl)).rejects.toThrow(
        'Cannot extract hostname from SSH URL',
      );
    });

    it('should throw error for unsupported hostname', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@unknown-host.com:org/repo.git';

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        'No known host key for unknown-host.com',
      );
    });

    it('should throw error when fingerprint mismatch detected', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@github.com:org/repo.git';

      // Return a key with different fingerprint
      childProcessStub.execSync.mockReturnValue(
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBadFingerprint123456789\n',
      );

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        'Host key verification failed for github.com',
      );
    });

    it('should throw error when ssh-keyscan fails', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@github.com:org/repo.git';

      childProcessStub.execSync.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        'Failed to verify host key for github.com',
      );
    });

    it('should throw error when ssh-keyscan returns no ed25519 key', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@github.com:org/repo.git';

      childProcessStub.execSync.mockReturnValue('github.com ssh-rsa AAAA...\n'); // No ed25519 key

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        'No ed25519 key found in ssh-keyscan output',
      );
    });

    it('should list supported hosts in error message for unsupported host', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@bitbucket.org:org/repo.git';

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        `Supported hosts: ${Object.keys(DEFAULT_KNOWN_HOSTS).join(', ')}`,
      );
    });

    it('should throw error for invalid ssh-keyscan output format with fewer than 3 parts', async () => {
      const tempDir = '/tmp/test-dir';
      const sshUrl = 'git@github.com:org/repo.git';

      // Mock ssh-keyscan to return invalid output (only 2 parts instead of 3)
      childProcessStub.execSync.mockReturnValue('github.com ssh-ed25519\n'); // Missing key data

      await expect(createKnownHostsFile(tempDir, sshUrl)).rejects.toThrow(
        'Invalid ssh-keyscan output format',
      );
    });
  });

  describe('createMockResponse', () => {
    it('should create a mock response object with default values', () => {
      const mockResponse = createMockResponse();

      expect(mockResponse).toBeDefined();
      expect(mockResponse.headers).toEqual({});
      expect(mockResponse.statusCode).toBe(200);
    });

    it('should set headers using set method', () => {
      const mockResponse = createMockResponse();

      const result = mockResponse.set({ 'Content-Type': 'application/json' });

      expect(mockResponse.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(result).toBe(mockResponse); // Should return itself for chaining
    });

    it('should merge multiple headers', () => {
      const mockResponse = createMockResponse();

      mockResponse.set({ 'Content-Type': 'application/json' });
      mockResponse.set({ Authorization: 'Bearer token' });

      expect(mockResponse.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      });
    });

    it('should set status code using status method', () => {
      const mockResponse = createMockResponse();

      const result = mockResponse.status(404);

      expect(mockResponse.statusCode).toBe(404);
      expect(result).toBe(mockResponse); // Should return itself for chaining
    });

    it('should allow method chaining', () => {
      const mockResponse = createMockResponse();

      const result = mockResponse.status(201).set({ 'X-Custom-Header': 'value' }).send();

      expect(mockResponse.statusCode).toBe(201);
      expect(mockResponse.headers).toEqual({ 'X-Custom-Header': 'value' });
      expect(result).toBe(mockResponse);
    });

    it('should return itself from send method', () => {
      const mockResponse = createMockResponse();

      const result = mockResponse.send();

      expect(result).toBe(mockResponse);
    });

    it('should handle multiple status changes', () => {
      const mockResponse = createMockResponse();

      mockResponse.status(400);
      expect(mockResponse.statusCode).toBe(400);

      mockResponse.status(500);
      expect(mockResponse.statusCode).toBe(500);
    });

    it('should preserve existing headers when setting new ones', () => {
      const mockResponse = createMockResponse();

      mockResponse.set({ Header1: 'value1' });
      mockResponse.set({ Header2: 'value2' });

      expect(mockResponse.headers).toEqual({
        Header1: 'value1',
        Header2: 'value2',
      });
    });
  });

  describe('validateSSHPrerequisites', () => {
    it('should pass when agent forwarding is enabled', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      expect(() => validateSSHPrerequisites(mockClient)).not.toThrow();
    });

    it('should throw error when agent forwarding is disabled', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: false,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      expect(() => validateSSHPrerequisites(mockClient)).toThrow(
        'SSH agent forwarding is required',
      );
    });

    it('should include helpful instructions in error message', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: false,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      try {
        validateSSHPrerequisites(mockClient);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('git config core.sshCommand');
        expect((error as Error).message).toContain('ssh -A');
        expect((error as Error).message).toContain('ssh-add');
      }
    });
  });

  describe('createSSHConnectionOptions', () => {
    it('should create basic connection options', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com');

      expect(options.host).toBe('github.com');
      expect(options.port).toBe(22);
      expect(options.username).toBe('git');
      expect(options.tryKeyboard).toBe(false);
      expect(options.readyTimeout).toBe(30000);
      expect(options.agent).toBeDefined();
    });

    it('should not include agent when agent forwarding is disabled', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: false,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com');

      expect(options.agent).toBeUndefined();
    });

    it('should include keepalive options when requested', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com', { keepalive: true });

      expect(options.keepaliveInterval).toBe(15000);
      expect(options.keepaliveCountMax).toBe(5);
      expect(options.windowSize).toBeDefined();
      expect(options.packetSize).toBeDefined();
    });

    it('should not include keepalive options when not requested', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com');

      expect(options.keepaliveInterval).toBeUndefined();
      expect(options.keepaliveCountMax).toBeUndefined();
    });

    it('should include debug function when requested', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com', { debug: true });

      expect(options.debug).toBeInstanceOf(Function);
    });

    it('should call debug function when debug is enabled', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const options = createSSHConnectionOptions(mockClient, 'github.com', { debug: true });

      // Call the debug function to cover lines 107-108
      options.debug('Test debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[GitHub SSH Debug]', 'Test debug message');

      consoleDebugSpy.mockRestore();
    });

    it('should not include debug function when not requested', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com');

      expect(options.debug).toBeUndefined();
    });

    it('should include hostVerifier function', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'github.com');

      expect(options.hostVerifier).toBeInstanceOf(Function);
    });

    it('should handle all options together', () => {
      const mockClient: ClientWithUser = {
        agentForwardingEnabled: true,
        authenticatedUser: { username: 'testuser' },
        clientIp: '127.0.0.1',
      } as any;

      const options = createSSHConnectionOptions(mockClient, 'gitlab.com', {
        debug: true,
        keepalive: true,
      });

      expect(options.host).toBe('gitlab.com');
      expect(options.agent).toBeDefined();
      expect(options.debug).toBeInstanceOf(Function);
      expect(options.keepaliveInterval).toBe(15000);
    });
  });
});
