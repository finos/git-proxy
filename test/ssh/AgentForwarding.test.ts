import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { LazySSHAgent, createLazyAgent } from '../../src/proxy/ssh/AgentForwarding';
import { SSHAgentProxy } from '../../src/proxy/ssh/AgentProxy';
import { ClientWithUser } from '../../src/proxy/ssh/types';

describe('AgentForwarding', () => {
  let mockClient: Partial<ClientWithUser>;
  let mockAgentProxy: Partial<SSHAgentProxy>;
  let openChannelFn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      agentForwardingEnabled: true,
      clientIp: '127.0.0.1',
      authenticatedUser: { username: 'testuser' },
    };

    mockAgentProxy = {
      getIdentities: vi.fn(),
      sign: vi.fn(),
      close: vi.fn(),
    };

    openChannelFn = vi.fn();
  });

  describe('LazySSHAgent', () => {
    describe('getIdentities', () => {
      it('should get identities from agent proxy', () => {
        return new Promise<void>((resolve) => {
          const identities = [
            {
              publicKeyBlob: Buffer.from('key1'),
              comment: 'test-key-1',
              algorithm: 'ssh-ed25519',
            },
          ];

          mockAgentProxy.getIdentities = vi.fn().mockResolvedValue(identities);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.getIdentities((err: Error | null, keys?: Buffer[]) => {
            expect(err).toBeNull();
            expect(keys).toHaveLength(1);
            expect(keys![0]).toEqual(Buffer.from('key1'));
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should throw error when no identities found', () => {
        return new Promise<void>((resolve) => {
          mockAgentProxy.getIdentities = vi.fn().mockResolvedValue([]);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.getIdentities((err: Error | null) => {
            expect(err).toBeDefined();
            expect(err!.message).toContain('No identities found');
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should handle error when agent channel cannot be opened', () => {
        return new Promise<void>((resolve) => {
          openChannelFn.mockResolvedValue(null);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.getIdentities((err: Error | null) => {
            expect(err).toBeDefined();
            expect(err!.message).toContain('Could not open agent channel');
            resolve();
          });
        });
      });

      it('should handle error from agent proxy', () => {
        return new Promise<void>((resolve) => {
          const testError = new Error('Agent protocol error');
          mockAgentProxy.getIdentities = vi.fn().mockRejectedValue(testError);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.getIdentities((err: Error | null) => {
            expect(err).toBe(testError);
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should close agent proxy on error', () => {
        return new Promise<void>((resolve) => {
          mockAgentProxy.getIdentities = vi.fn().mockRejectedValue(new Error('Test error'));
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.getIdentities((err: Error | null) => {
            expect(err).toBeDefined();
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });
    });

    describe('sign', () => {
      it('should sign data using agent proxy with ParsedKey object', () => {
        return new Promise<void>((resolve) => {
          const signature = Buffer.from('signature-data');
          const pubKeyBlob = Buffer.from('public-key-blob');
          const dataToSign = Buffer.from('data-to-sign');

          mockAgentProxy.sign = vi.fn().mockResolvedValue(signature);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const pubKey = {
            getPublicSSH: vi.fn().mockReturnValue(pubKeyBlob),
          };

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.sign(pubKey, dataToSign, {}, (err: Error | null, sig?: Buffer) => {
            expect(err).toBeNull();
            expect(sig).toEqual(signature);
            expect(pubKey.getPublicSSH).toHaveBeenCalled();
            expect(mockAgentProxy.sign).toHaveBeenCalledWith(pubKeyBlob, dataToSign);
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should sign data using agent proxy with Buffer pubKey', () => {
        return new Promise<void>((resolve) => {
          const signature = Buffer.from('signature-data');
          const pubKeyBlob = Buffer.from('public-key-blob');
          const dataToSign = Buffer.from('data-to-sign');

          mockAgentProxy.sign = vi.fn().mockResolvedValue(signature);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.sign(pubKeyBlob, dataToSign, {}, (err: Error | null, sig?: Buffer) => {
            expect(err).toBeNull();
            expect(sig).toEqual(signature);
            expect(mockAgentProxy.sign).toHaveBeenCalledWith(pubKeyBlob, dataToSign);
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should handle options as callback parameter', () => {
        return new Promise<void>((resolve) => {
          const signature = Buffer.from('signature-data');
          const pubKeyBlob = Buffer.from('public-key-blob');
          const dataToSign = Buffer.from('data-to-sign');

          mockAgentProxy.sign = vi.fn().mockResolvedValue(signature);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          // Call with options as third parameter (callback)
          agent.sign(
            pubKeyBlob,
            dataToSign,
            (err: Error | null, sig?: Buffer) => {
              expect(err).toBeNull();
              expect(sig).toEqual(signature);
              resolve();
            },
            undefined,
          );
        });
      });

      it('should handle invalid pubKey format', () => {
        return new Promise<void>((resolve) => {
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const invalidPubKey = { invalid: 'format' };

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.sign(invalidPubKey, Buffer.from('data'), {}, (err: Error | null) => {
            expect(err).toBeDefined();
            expect(err!.message).toContain('Invalid pubKey format');
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should handle error when agent channel cannot be opened', () => {
        return new Promise<void>((resolve) => {
          openChannelFn.mockResolvedValue(null);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.sign(Buffer.from('key'), Buffer.from('data'), {}, (err: Error | null) => {
            expect(err).toBeDefined();
            expect(err!.message).toContain('Could not open agent channel');
            resolve();
          });
        });
      });

      it('should handle error from agent proxy sign', () => {
        return new Promise<void>((resolve) => {
          const testError = new Error('Sign failed');
          mockAgentProxy.sign = vi.fn().mockRejectedValue(testError);
          openChannelFn.mockResolvedValue(mockAgentProxy);

          const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

          agent.sign(Buffer.from('key'), Buffer.from('data'), {}, (err: Error | null) => {
            expect(err).toBe(testError);
            expect(mockAgentProxy.close).toHaveBeenCalled();
            resolve();
          });
        });
      });

      it('should work without callback parameter', () => {
        mockAgentProxy.sign = vi.fn().mockResolvedValue(Buffer.from('sig'));
        openChannelFn.mockResolvedValue(mockAgentProxy);

        const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

        // Should not throw when callback is undefined
        expect(() => {
          agent.sign(Buffer.from('key'), Buffer.from('data'), {});
        }).not.toThrow();
      });
    });

    describe('operation serialization', () => {
      it('should serialize multiple getIdentities calls', async () => {
        const identities = [
          {
            publicKeyBlob: Buffer.from('key1'),
            comment: 'test-key-1',
            algorithm: 'ssh-ed25519',
          },
        ];

        mockAgentProxy.getIdentities = vi.fn().mockResolvedValue(identities);
        openChannelFn.mockResolvedValue(mockAgentProxy);

        const agent = new LazySSHAgent(openChannelFn, mockClient as ClientWithUser);

        const results: any[] = [];

        // Start 3 concurrent getIdentities calls
        const promise1 = new Promise((resolve) => {
          agent.getIdentities((err: Error | null, keys?: Buffer[]) => {
            results.push({ err, keys });
            resolve(undefined);
          });
        });

        const promise2 = new Promise((resolve) => {
          agent.getIdentities((err: Error | null, keys?: Buffer[]) => {
            results.push({ err, keys });
            resolve(undefined);
          });
        });

        const promise3 = new Promise((resolve) => {
          agent.getIdentities((err: Error | null, keys?: Buffer[]) => {
            results.push({ err, keys });
            resolve(undefined);
          });
        });

        await Promise.all([promise1, promise2, promise3]);

        // All three should complete
        expect(results).toHaveLength(3);
        expect(openChannelFn).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('createLazyAgent', () => {
    it('should create a LazySSHAgent instance', () => {
      const agent = createLazyAgent(mockClient as ClientWithUser);

      expect(agent).toBeInstanceOf(LazySSHAgent);
    });
  });

  describe('openTemporaryAgentChannel', () => {
    it('should return null when client has no protocol', async () => {
      const { openTemporaryAgentChannel } = await import('../../src/proxy/ssh/AgentForwarding');

      const clientWithoutProtocol: any = {
        agentForwardingEnabled: true,
      };

      const result = await openTemporaryAgentChannel(clientWithoutProtocol);

      expect(result).toBeNull();
    });

    it('should handle timeout when channel confirmation not received', async () => {
      const { openTemporaryAgentChannel } = await import('../../src/proxy/ssh/AgentForwarding');

      const mockClient: any = {
        agentForwardingEnabled: true,
        _protocol: {
          _handlers: {},
          openssh_authAgent: vi.fn(),
        },
        _chanMgr: {
          _channels: {},
        },
      };

      const result = await openTemporaryAgentChannel(mockClient);

      // Should timeout and return null after 5 seconds
      expect(result).toBeNull();
    }, 6000);

    it('should find next available channel ID when channels exist', async () => {
      const { openTemporaryAgentChannel } = await import('../../src/proxy/ssh/AgentForwarding');

      const mockClient: any = {
        agentForwardingEnabled: true,
        _protocol: {
          _handlers: {},
          openssh_authAgent: vi.fn(),
        },
        _chanMgr: {
          _channels: {
            1: 'occupied',
            2: 'occupied',
            // Channel 3 should be used
          },
        },
      };

      // Start the operation but don't wait for completion (will timeout)
      const promise = openTemporaryAgentChannel(mockClient);

      // Verify openssh_authAgent was called with the next available channel (3)
      expect(mockClient._protocol.openssh_authAgent).toHaveBeenCalledWith(
        3,
        expect.any(Number),
        expect.any(Number),
      );

      // Clean up - wait for timeout
      await promise;
    }, 6000);

    it('should use channel ID 1 when no channels exist', async () => {
      const { openTemporaryAgentChannel } = await import('../../src/proxy/ssh/AgentForwarding');

      const mockClient: any = {
        agentForwardingEnabled: true,
        _protocol: {
          _handlers: {},
          openssh_authAgent: vi.fn(),
        },
        _chanMgr: {
          _channels: {},
        },
      };

      const promise = openTemporaryAgentChannel(mockClient);

      expect(mockClient._protocol.openssh_authAgent).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        expect.any(Number),
      );

      await promise;
    }, 6000);

    it('should handle client without chanMgr', async () => {
      const { openTemporaryAgentChannel } = await import('../../src/proxy/ssh/AgentForwarding');

      const mockClient: any = {
        agentForwardingEnabled: true,
        _protocol: {
          _handlers: {},
          openssh_authAgent: vi.fn(),
        },
        // No _chanMgr
      };

      const promise = openTemporaryAgentChannel(mockClient);

      // Should use default channel ID 1
      expect(mockClient._protocol.openssh_authAgent).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        expect.any(Number),
      );

      await promise;
    }, 6000);
  });
});
