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

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  LazySSHAgent,
  createLazyAgent,
  openTemporaryAgentChannel,
} from '../../src/proxy/ssh/AgentForwarding';
import { SSHAgentProxy } from '../../src/proxy/ssh/AgentProxy';
import { ClientWithUser } from '../../src/proxy/ssh/types';
import * as sshInternals from '../../src/proxy/ssh/sshInternals';

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
      const clientWithoutProtocol: any = {
        agentForwardingEnabled: true,
      };

      const result = await openTemporaryAgentChannel(clientWithoutProtocol);

      expect(result).toBeNull();
    });

    it('should handle timeout when channel confirmation not received', async () => {
      vi.useFakeTimers();
      try {
        const mockClient: any = {
          agentForwardingEnabled: true,
          _protocol: {
            _handlers: {},
            openssh_authAgent: vi.fn(),
            channelSuccess: vi.fn(),
          },
          _chanMgr: {
            _channels: {},
            _count: 0,
          },
        };

        const promise = openTemporaryAgentChannel(mockClient);

        // Advance past the 5s confirmation window instead of waiting in real time
        vi.advanceTimersByTime(5001);
        const result = await promise;

        expect(result).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should find next available channel ID when channels exist', async () => {
      vi.useFakeTimers();
      try {
        const mockClient: any = {
          agentForwardingEnabled: true,
          _protocol: {
            _handlers: {},
            openssh_authAgent: vi.fn(),
            channelSuccess: vi.fn(),
          },
          _chanMgr: {
            _channels: {
              1: 'occupied',
              2: 'occupied',
              // Channel 3 should be used
            },
            _count: 2,
          },
        };

        const promise = openTemporaryAgentChannel(mockClient);

        // openssh_authAgent is called synchronously, before the promise settles
        expect(mockClient._protocol.openssh_authAgent).toHaveBeenCalledWith(
          3,
          expect.any(Number),
          expect.any(Number),
        );

        // Advance past the confirmation timeout so the promise settles cleanly
        vi.advanceTimersByTime(5001);
        await promise;
      } finally {
        vi.useRealTimers();
      }
    });

    it('should use channel ID 1 when no channels exist', async () => {
      vi.useFakeTimers();
      try {
        const mockClient: any = {
          agentForwardingEnabled: true,
          _protocol: {
            _handlers: {},
            openssh_authAgent: vi.fn(),
            channelSuccess: vi.fn(),
          },
          _chanMgr: {
            _channels: {},
            _count: 0,
          },
        };

        const promise = openTemporaryAgentChannel(mockClient);

        expect(mockClient._protocol.openssh_authAgent).toHaveBeenCalledWith(
          1,
          expect.any(Number),
          expect.any(Number),
        );

        vi.advanceTimersByTime(5001);
        await promise;
      } finally {
        vi.useRealTimers();
      }
    });

    it('should return null when client has no chanMgr', async () => {
      const mockClient: any = {
        agentForwardingEnabled: true,
        _protocol: {
          _handlers: {},
          openssh_authAgent: vi.fn(),
          channelSuccess: vi.fn(),
        },
      };

      const result = await openTemporaryAgentChannel(mockClient);

      expect(result).toBeNull();
      expect(mockClient._protocol.openssh_authAgent).not.toHaveBeenCalled();
    });

    describe('CHANNEL_OPEN_CONFIRMATION handler', () => {
      let getChannelModuleSpy: ReturnType<typeof vi.spyOn>;

      afterEach(() => {
        getChannelModuleSpy?.mockRestore();
      });

      function makeMockClient(existingHandler?: (...args: unknown[]) => void) {
        const handlers: Record<string, (...args: unknown[]) => void> = {};
        if (existingHandler) {
          handlers.CHANNEL_OPEN_CONFIRMATION = existingHandler;
        }
        return {
          _protocol: {
            _handlers: handlers,
            openssh_authAgent: vi.fn(),
            channelSuccess: vi.fn(),
          },
          _chanMgr: { _channels: {} as Record<number, any>, _count: 0 },
        } as any;
      }

      function mockChannelModule(channelImpl?: (...args: unknown[]) => unknown) {
        const mockChannel = { on: vi.fn(), write: vi.fn(), end: vi.fn() };
        getChannelModuleSpy = vi.spyOn(sshInternals, 'getChannelModule').mockReturnValue({
          Channel: channelImpl ?? vi.fn().mockReturnValue(mockChannel),
          MAX_WINDOW: 2 * 1024 * 1024,
          PACKET_SIZE: 32 * 1024,
        });
        return mockChannel;
      }

      it('should create AgentProxy on successful confirmation', async () => {
        mockChannelModule();
        const client = makeMockClient();

        const promise = openTemporaryAgentChannel(client);

        const handler = client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION;
        handler(null, { recipient: 1, sender: 42, window: 65536, packetSize: 32768 });

        const result = await promise;

        expect(result).toBeInstanceOf(SSHAgentProxy);
        expect(client._chanMgr._channels[1]).toBeDefined();
        expect(client._chanMgr._count).toBe(1);
      });

      it('should call and restore original handler on confirmation', async () => {
        mockChannelModule();
        const originalHandler = vi.fn();
        const client = makeMockClient(originalHandler);

        const promise = openTemporaryAgentChannel(client);

        const handler = client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION;
        const confirmInfo = { recipient: 1, sender: 42, window: 65536, packetSize: 32768 };
        handler(null, confirmInfo);

        await promise;

        expect(originalHandler).toHaveBeenCalledWith(null, confirmInfo);
        expect(client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION).toBe(originalHandler);
      });

      it('should delete handler when no original existed', async () => {
        mockChannelModule();
        const client = makeMockClient();

        const promise = openTemporaryAgentChannel(client);

        const handler = client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION;
        handler(null, { recipient: 1, sender: 42, window: 65536, packetSize: 32768 });

        await promise;

        expect(client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION).toBeUndefined();
      });

      it('should ignore confirmation for non-matching channel recipient', async () => {
        vi.useFakeTimers();
        try {
          mockChannelModule();
          const client = makeMockClient();

          const promise = openTemporaryAgentChannel(client);

          const handler = client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION;
          handler(null, { recipient: 999, sender: 42, window: 65536, packetSize: 32768 });

          vi.advanceTimersByTime(5001);

          const result = await promise;
          expect(result).toBeNull();
        } finally {
          vi.useRealTimers();
        }
      });

      it('should resolve null when Channel constructor throws', async () => {
        mockChannelModule(function () {
          throw new Error('Channel creation failed');
        });
        const client = makeMockClient();

        const promise = openTemporaryAgentChannel(client);

        const handler = client._protocol._handlers.CHANNEL_OPEN_CONFIRMATION;
        handler(null, { recipient: 1, sender: 42, window: 65536, packetSize: 32768 });

        const result = await promise;
        expect(result).toBeNull();
      });
    });
  });

  describe('LazySSHAgent - lock recovery', () => {
    it('should continue operating after a previous operation fails', () => {
      return new Promise<void>((resolve) => {
        const openChannelFn = vi.fn();
        const client = {
          agentForwardingEnabled: true,
          clientIp: '127.0.0.1',
          authenticatedUser: { username: 'testuser' },
        } as unknown as ClientWithUser;

        openChannelFn.mockRejectedValueOnce(new Error('Channel open failed'));

        const identities = [
          { publicKeyBlob: Buffer.from('key1'), comment: 'k', algorithm: 'ssh-ed25519' },
        ];
        const mockProxy = {
          getIdentities: vi.fn().mockResolvedValue(identities),
          sign: vi.fn(),
          close: vi.fn(),
        };
        openChannelFn.mockResolvedValueOnce(mockProxy);

        const agent = new LazySSHAgent(openChannelFn, client);

        agent.getIdentities((err) => {
          expect(err).toBeDefined();

          agent.getIdentities((err2, keys) => {
            expect(err2).toBeNull();
            expect(keys).toHaveLength(1);
            resolve();
          });
        });
      });
    });
  });
});
