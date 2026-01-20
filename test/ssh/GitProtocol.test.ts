import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ssh2 module
vi.mock('ssh2', () => ({
  Client: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    exec: vi.fn(),
  })),
}));

// Mock sshHelpers
vi.mock('../../src/proxy/ssh/sshHelpers', () => ({
  validateSSHPrerequisites: vi.fn(),
  createSSHConnectionOptions: vi.fn(() => ({
    host: 'github.com',
    port: 22,
    username: 'git',
  })),
}));

// Import after mocking
import { fetchGitHubCapabilities, fetchRepositoryData } from '../../src/proxy/ssh/GitProtocol';
import { ClientWithUser } from '../../src/proxy/ssh/types';

describe('GitProtocol', () => {
  let mockClient: Partial<ClientWithUser>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      agentForwardingEnabled: true,
      authenticatedUser: {
        username: 'testuser',
        email: 'test@example.com',
      },
      clientIp: '127.0.0.1',
    };
  });

  describe('fetchGitHubCapabilities', () => {
    it('should reject when SSH connection fails', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              // Immediately call error handler
              setImmediate(() => handler(new Error('Connection refused')));
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('Connection refused');
    });

    it('should handle authentication failures with helpful message', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setImmediate(() =>
                handler(new Error('All configured authentication methods failed')),
              );
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('All configured authentication methods failed');
    });
  });

  describe('fetchRepositoryData', () => {
    it('should reject when SSH connection fails', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setImmediate(() => handler(new Error('Connection timeout')));
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      await expect(
        fetchRepositoryData(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
          '0009want abc\n0000',
        ),
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('validateSSHPrerequisites integration', () => {
    it('should call validateSSHPrerequisites before connecting', async () => {
      const { validateSSHPrerequisites } = await import('../../src/proxy/ssh/sshHelpers');
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setImmediate(() => handler(new Error('Test error')));
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      try {
        await fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        );
      } catch (e) {
        // Expected to fail
      }

      expect(validateSSHPrerequisites).toHaveBeenCalledWith(mockClient);
    });
  });

  describe('error handling', () => {
    it('should provide GitHub-specific help for authentication failures on github.com', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const mockStream = {
        stderr: {
          write: vi.fn(),
        },
        exit: vi.fn(),
        end: vi.fn(),
      };

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setImmediate(() => {
                const error = new Error('All configured authentication methods failed');
                handler(error);
              });
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      // Import the function that uses clientStream
      const { forwardPackDataToRemote } = await import('../../src/proxy/ssh/GitProtocol');

      try {
        await forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockStream as any,
          mockClient as ClientWithUser,
          Buffer.from('test'),
          0,
          'github.com',
        );
      } catch (e) {
        // Expected to fail
      }

      // Check that helpful error message was written to stderr
      expect(mockStream.stderr.write).toHaveBeenCalled();
      const errorMessage = mockStream.stderr.write.mock.calls[0][0];
      expect(errorMessage).toContain('SSH Authentication Failed');
      expect(errorMessage).toContain('https://github.com/settings/keys');
    });

    it('should provide GitLab-specific help for authentication failures on gitlab.com', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const mockStream = {
        stderr: {
          write: vi.fn(),
        },
        exit: vi.fn(),
        end: vi.fn(),
      };

      Client.mockImplementation(() => {
        const mockClient = {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setImmediate(() => {
                const error = new Error('All configured authentication methods failed');
                handler(error);
              });
            }
            return mockClient;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return mockClient;
      });

      const { forwardPackDataToRemote } = await import('../../src/proxy/ssh/GitProtocol');

      try {
        await forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockStream as any,
          mockClient as ClientWithUser,
          Buffer.from('test'),
          0,
          'gitlab.com',
        );
      } catch (e) {
        // Expected to fail
      }

      expect(mockStream.stderr.write).toHaveBeenCalled();
      const errorMessage = mockStream.stderr.write.mock.calls[0][0];
      expect(errorMessage).toContain('SSH Authentication Failed');
      expect(errorMessage).toContain('https://gitlab.com/-/profile/keys');
    });
  });
});
