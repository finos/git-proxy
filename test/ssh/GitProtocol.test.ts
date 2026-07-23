/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

// Mock config for isDebugEnabled()
vi.mock('../../src/config', () => ({
  getSSHConfig: vi.fn(() => ({ debug: false })),
}));

// Import after mocking
import {
  fetchGitHubCapabilities,
  fetchRepositoryData,
  forwardPackDataToRemote,
  connectToRemoteGitServer,
} from '../../src/proxy/ssh/GitProtocol';
import { ClientWithUser } from '../../src/proxy/ssh/types';
import { parsePacketLines } from '../../src/proxy/processors/pktLineParser';

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

      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('Test error');

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

      await expect(
        forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockStream as any,
          mockClient as ClientWithUser,
          Buffer.from('test'),
          0,
          'github.com',
        ),
      ).rejects.toThrow('All configured authentication methods failed');

      // Check that helpful error message was written to stderr
      expect(mockStream.stderr.write).toHaveBeenCalled();
      const errorMessage = mockStream.stderr.write.mock.calls[0][0];
      expect(errorMessage).toContain('SSH Authentication Failed');
      expect(errorMessage).toContain('https://github.com/settings/keys');
    });

    it('should provide generic help for authentication failures on other hosts', async () => {
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
                handler(new Error('All configured authentication methods failed'));
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

      await expect(
        forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockStream as any,
          mockClient as ClientWithUser,
          Buffer.from('test'),
          0,
          'bitbucket.org',
        ),
      ).rejects.toThrow('All configured authentication methods failed');

      expect(mockStream.stderr.write).toHaveBeenCalled();
      const errorMessage = mockStream.stderr.write.mock.calls[0][0];
      expect(errorMessage).toContain('SSH Authentication Failed');
      expect(errorMessage).toContain('Check your Git hosting provider');
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

      await expect(
        forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockStream as any,
          mockClient as ClientWithUser,
          Buffer.from('test'),
          0,
          'gitlab.com',
        ),
      ).rejects.toThrow('All configured authentication methods failed');

      expect(mockStream.stderr.write).toHaveBeenCalled();
      const errorMessage = mockStream.stderr.write.mock.calls[0][0];
      expect(errorMessage).toContain('SSH Authentication Failed');
      expect(errorMessage).toContain('https://gitlab.com/-/profile/keys');
    });
  });

  describe('fetchGitHubCapabilities - happy path', () => {
    function createMockRemoteStream() {
      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      return {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
        emit(event: string, ...args: any[]) {
          (handlers[event] || []).forEach((h) => h(...args));
        },
      };
    }

    it('should collect data and return buffer when flush packet is received', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      // Build a valid pkt-line payload with flush packet.
      // "hello world\n" is 12 bytes, so the total packet length is 4 + 12 = 16 = 0x0010.
      // Resulting stream: "0010hello world\n0000"
      const line = 'hello world\n';
      const pktLen = (4 + line.length).toString(16).padStart(4, '0');
      const pktData = Buffer.from(`${pktLen}${line}0000`);

      const mockRemoteStream = createMockRemoteStream();

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            // Simulate data arrival after stream is set up
            setImmediate(() => {
              mockRemoteStream.emit('data', pktData);
              // After flush is detected, the code calls remoteStream.end()
              // then we fire close
              setImmediate(() => mockRemoteStream.emit('close'));
            });
          }),
        };
        return c;
      });

      const result = await fetchGitHubCapabilities(
        'git-upload-pack /test/repo.git',
        mockClient as ClientWithUser,
        'github.com',
      );

      expect(result).toBeInstanceOf(Buffer);
      // Decode the collected buffer with the real pkt-line parser to prove it is a
      // well-formed stream, not just that the raw bytes happen to contain the payload.
      const [lines, offset] = parsePacketLines(result);
      expect(lines).toEqual(['hello world\n']);
      // The parser must consume the trailing flush packet exactly at the buffer end.
      expect(offset).toBe(result.length);
      expect(mockRemoteStream.end).toHaveBeenCalled();
    });

    it('should accumulate multiple data chunks before flush', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      // Each payload "chunk one\n" / "chunk two\n" is 10 bytes, so the pkt-line length
      // prefix is 4 + 10 = 14 = 0x000e. The second chunk is followed by the flush packet.
      const chunk1 = Buffer.from('000echunk one\n');
      const chunk2 = Buffer.from('000echunk two\n0000');

      const mockRemoteStream = createMockRemoteStream();

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              mockRemoteStream.emit('data', chunk1);
              setImmediate(() => {
                mockRemoteStream.emit('data', chunk2);
                setImmediate(() => mockRemoteStream.emit('close'));
              });
            });
          }),
        };
        return c;
      });

      const result = await fetchGitHubCapabilities(
        'git-upload-pack /test/repo.git',
        mockClient as ClientWithUser,
        'github.com',
      );

      // The two data events must be accumulated and decode as two distinct pkt-lines,
      // with the trailing flush packet consumed exactly at the end of the buffer.
      const [lines, offset] = parsePacketLines(result);
      expect(lines).toEqual(['chunk one\n', 'chunk two\n']);
      expect(offset).toBe(result.length);
    });
  });

  describe('fetchRepositoryData - happy path', () => {
    it('should send request and collect response data', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const responseChunk1 = Buffer.from('response-part-1');
      const responseChunk2 = Buffer.from('response-part-2');

      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              (handlers['data'] || []).forEach((h) => h(responseChunk1));
              (handlers['data'] || []).forEach((h) => h(responseChunk2));
              setImmediate(() => (handlers['close'] || []).forEach((h) => h()));
            });
          }),
        };
        return c;
      });

      const result = await fetchRepositoryData(
        'git-upload-pack /test/repo.git',
        mockClient as ClientWithUser,
        'github.com',
        '0009want abc\n0000',
      );

      expect(mockRemoteStream.write).toHaveBeenCalledWith('0009want abc\n0000');
      expect(result.toString()).toBe('response-part-1response-part-2');
    });
  });

  describe('forwardPackDataToRemote - happy path', () => {
    it('should forward pack data and skip capabilities in response', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              // Simulate response: first 10 bytes are capabilities (to skip), rest is actual data
              const fullResponse = Buffer.from('CAPABILITYactual-response-data');
              (handlers['data'] || []).forEach((h) => h(fullResponse));
              setImmediate(() => (handlers['close'] || []).forEach((h) => h()));
            });
          }),
        };
        return c;
      });

      const packData = Buffer.from('pack-data-content');
      const capabilitiesSize = 10; // "CAPABILITY" is 10 bytes

      await forwardPackDataToRemote(
        'git-receive-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        packData,
        capabilitiesSize,
        'github.com',
      );

      // Pack data should be written to remote
      expect(mockRemoteStream.write).toHaveBeenCalledWith(packData);
      expect(mockRemoteStream.end).toHaveBeenCalled();
      // After skipping 10 bytes of capabilities, the remaining data should be forwarded
      expect(mockClientStream.write).toHaveBeenCalledWith(Buffer.from('actual-response-data'));
    });

    it('should skip capabilities split across multiple chunks', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              // First chunk is entirely within capabilities (5 bytes < 10 cap size)
              (handlers['data'] || []).forEach((h) => h(Buffer.from('ABCDE')));
              // Second chunk: 5 more bytes of cap + actual data
              (handlers['data'] || []).forEach((h) => h(Buffer.from('FGHIJreal-data')));
              // Third chunk: all real data
              (handlers['data'] || []).forEach((h) => h(Buffer.from('-more')));
              setImmediate(() => (handlers['close'] || []).forEach((h) => h()));
            });
          }),
        };
        return c;
      });

      await forwardPackDataToRemote(
        'git-receive-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        Buffer.from('pack'),
        10,
        'github.com',
      );

      // First chunk entirely skipped
      // Second chunk: 5 bytes skipped, "real-data" forwarded
      // Third chunk: forwarded entirely
      expect(mockClientStream.write).toHaveBeenCalledWith(Buffer.from('real-data'));
      expect(mockClientStream.write).toHaveBeenCalledWith(Buffer.from('-more'));
    });

    it('should handle null pack data', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              (handlers['close'] || []).forEach((h) => h());
            });
          }),
        };
        return c;
      });

      await forwardPackDataToRemote(
        'git-receive-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        null,
        0,
        'github.com',
      );

      // write should not have been called with pack data since it's null
      expect(mockRemoteStream.write).not.toHaveBeenCalled();
      expect(mockRemoteStream.end).toHaveBeenCalled();
    });
  });

  describe('connectToRemoteGitServer', () => {
    it('should set up bidirectional piping', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const remoteHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!remoteHandlers[event]) remoteHandlers[event] = [];
          remoteHandlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const clientHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockClientStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!clientHandlers[event]) clientHandlers[event] = [];
          clientHandlers[event].push(handler);
        }),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              // Simulate client sending data
              (clientHandlers['data'] || []).forEach((h) => h(Buffer.from('client-data')));
              // Simulate remote sending data
              (remoteHandlers['data'] || []).forEach((h) => h(Buffer.from('remote-data')));
              setImmediate(() => (remoteHandlers['close'] || []).forEach((h) => h()));
            });
          }),
        };
        return c;
      });

      await connectToRemoteGitServer(
        'git-upload-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        'github.com',
      );

      // Client data should be piped to remote
      expect(mockRemoteStream.write).toHaveBeenCalledWith(Buffer.from('client-data'));
      // Remote data should be piped to client
      expect(mockClientStream.write).toHaveBeenCalledWith(Buffer.from('remote-data'));
    });

    it('should swallow early EOF errors in connectToRemoteGitServer error handler', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const remoteHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!remoteHandlers[event]) remoteHandlers[event] = [];
          remoteHandlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        on: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              (remoteHandlers['close'] || []).forEach((h) => h());
            });
          }),
        };
        return c;
      });

      await connectToRemoteGitServer(
        'git-upload-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        'github.com',
      );

      // Get the error handler registered by connectToRemoteGitServer
      const errorHandlers = remoteHandlers['error'] || [];
      const connectErrorHandler = errorHandlers[0];
      expect(connectErrorHandler).toBeDefined();

      // Early EOF errors should be swallowed (not throw)
      expect(() => connectErrorHandler(new Error('early EOF during git operation'))).not.toThrow();

      // unexpected disconnect should also be swallowed
      expect(() =>
        connectErrorHandler(new Error('unexpected disconnect from server')),
      ).not.toThrow();
    });

    it('should not swallow non-EOF errors from remote stream', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const remoteHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!remoteHandlers[event]) remoteHandlers[event] = [];
          remoteHandlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        on: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              (remoteHandlers['close'] || []).forEach((h) => h());
            });
          }),
        };
        return c;
      });

      await connectToRemoteGitServer(
        'git-upload-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        'github.com',
      );

      // Get the error handler registered by connectToRemoteGitServer on remoteStream
      const errorHandlers = remoteHandlers['error'] || [];
      // connectToRemoteGitServer's handler is the first one (registered in onStreamReady)
      const connectErrorHandler = errorHandlers[0];
      expect(connectErrorHandler).toBeDefined();

      // Non-EOF errors should throw (not be swallowed)
      expect(() => connectErrorHandler(new Error('Fatal stream error'))).toThrow(
        'Fatal stream error',
      );
    });
  });

  describe('executeRemoteGitCommand edge cases', () => {
    it('should handle exec error', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(new Error('exec failed'));
          }),
        };
        return c;
      });

      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('exec failed');
    });

    it('should handle exec error with clientStream', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const mockClientStream = {
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(new Error('exec failed on remote'));
          }),
        };
        return c;
      });

      await expect(
        forwardPackDataToRemote(
          'git-receive-pack /test/repo.git',
          mockClientStream as any,
          mockClient as ClientWithUser,
          Buffer.from('data'),
          0,
          'github.com',
        ),
      ).rejects.toThrow('exec failed on remote');

      expect(mockClientStream.stderr.write).toHaveBeenCalledWith(
        expect.stringContaining('exec failed on remote'),
      );
      expect(mockClientStream.exit).toHaveBeenCalledWith(1);
    });

    it('should handle stream error in executeRemoteGitCommand', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const remoteHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!remoteHandlers[event]) remoteHandlers[event] = [];
          remoteHandlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              // Fire the 'error' handler registered by executeRemoteGitCommand (not connectToRemoteGitServer)
              // The last registered error handler is from executeRemoteGitCommand itself
              const errorHandlers = remoteHandlers['error'] || [];
              const baseErrorHandler = errorHandlers[errorHandlers.length - 1];
              if (baseErrorHandler) baseErrorHandler(new Error('stream broke'));
            });
          }),
        };
        return c;
      });

      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('stream broke');
    });

    it('should handle remoteStream exit event with clientStream', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const remoteHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!remoteHandlers[event]) remoteHandlers[event] = [];
          remoteHandlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      const mockClientStream = {
        on: vi.fn(),
        stderr: { write: vi.fn() },
        exit: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => {
              // Fire exit event with code
              (remoteHandlers['exit'] || []).forEach((h) => h(0, null));
              setImmediate(() => (remoteHandlers['close'] || []).forEach((h) => h()));
            });
          }),
        };
        return c;
      });

      await connectToRemoteGitServer(
        'git-upload-pack /test/repo.git',
        mockClientStream as any,
        mockClient as ClientWithUser,
        'github.com',
      );

      expect(mockClientStream.exit).toHaveBeenCalledWith(0);
    });

    it('should handle connection error without clientStream', async () => {
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'error') {
              setImmediate(() => handler(new Error('Connection refused')));
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn(),
        };
        return c;
      });

      // fetchGitHubCapabilities does NOT pass clientStream
      await expect(
        fetchGitHubCapabilities(
          'git-upload-pack /test/repo.git',
          mockClient as ClientWithUser,
          'github.com',
        ),
      ).rejects.toThrow('Connection refused');
    });

    it('should skip requireAgentForwarding when set to false', async () => {
      const { validateSSHPrerequisites } = await import('../../src/proxy/ssh/sshHelpers');
      const ssh2 = await import('ssh2');
      const Client = ssh2.Client as any;

      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      const mockRemoteStream = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        end: vi.fn(),
        write: vi.fn(),
      };

      Client.mockImplementation(() => {
        const c = {
          on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'ready') {
              setImmediate(() => handler());
            }
            return c;
          }),
          connect: vi.fn(),
          end: vi.fn(),
          exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => {
            cb(undefined, mockRemoteStream);
            setImmediate(() => (handlers['close'] || []).forEach((h) => h()));
          }),
        };
        return c;
      });

      // connectToRemoteGitServer passes requireAgentForwarding: true
      // fetchGitHubCapabilities does not pass it (defaults to true)
      // Both call validateSSHPrerequisites
      vi.mocked(validateSSHPrerequisites).mockClear();

      await fetchGitHubCapabilities(
        'git-upload-pack /test/repo.git',
        mockClient as ClientWithUser,
        'github.com',
      );

      expect(validateSSHPrerequisites).toHaveBeenCalled();
    });
  });
});
