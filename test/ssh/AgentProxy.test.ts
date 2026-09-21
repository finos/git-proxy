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
import { SSHAgentProxy } from '../../src/proxy/ssh/AgentProxy';
import { EventEmitter } from 'events';

// Mock Channel type
class MockChannel extends EventEmitter {
  destroyed = false;
  write = vi.fn();
  close = vi.fn();
}

describe('SSHAgentProxy', () => {
  let mockChannel: MockChannel;
  let agentProxy: SSHAgentProxy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel = new MockChannel();
  });

  describe('constructor and setup', () => {
    it('should create agent proxy and set up channel handlers', () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      expect(agentProxy).toBeDefined();
      expect(mockChannel.listenerCount('data')).toBe(1);
      expect(mockChannel.listenerCount('close')).toBe(1);
      expect(mockChannel.listenerCount('error')).toBe(1);
    });

    it('should emit close event when channel closes', () => {
      return new Promise<void>((resolve) => {
        agentProxy = new SSHAgentProxy(mockChannel as any);

        agentProxy.on('close', () => {
          resolve();
        });

        mockChannel.emit('close');
      });
    });

    it('should emit error event when channel has error', () => {
      return new Promise<void>((resolve) => {
        agentProxy = new SSHAgentProxy(mockChannel as any);
        const testError = new Error('Channel error');

        agentProxy.on('error', (err) => {
          expect(err).toBe(testError);
          resolve();
        });

        mockChannel.emit('error', testError);
      });
    });
  });

  describe('getIdentities', () => {
    it('should return identities from agent', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      // Mock agent response for identities request
      // Format: [type:1][num_keys:4][key_blob_len:4][key_blob][comment_len:4][comment]
      const keyBlob = Buffer.concat([
        Buffer.from([0, 0, 0, 11]), // algo length
        Buffer.from('ssh-ed25519'), // algo
        Buffer.from([0, 0, 0, 32]), // key data length
        Buffer.alloc(32, 0x42), // key data
      ]);

      const response = Buffer.concat([
        Buffer.from([12]), // SSH_AGENT_IDENTITIES_ANSWER
        Buffer.from([0, 0, 0, 1]), // num_keys = 1
        Buffer.from([0, 0, 0, keyBlob.length]), // key_blob_len
        keyBlob,
        Buffer.from([0, 0, 0, 7]), // comment_len
        Buffer.from('test key'), // comment (length 7+1)
      ]);

      // Set up mock to send response when write is called
      mockChannel.write.mockImplementation(() => {
        // Simulate agent sending response
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      const identities = await agentProxy.getIdentities();

      expect(identities).toHaveLength(1);
      expect(identities[0].algorithm).toBe('ssh-ed25519');
      expect(identities[0].comment).toBe('test ke');
      expect(identities[0].publicKeyBlob).toEqual(keyBlob);
    });

    it('should throw error when agent returns failure', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const response = Buffer.from([5]); // SSH_AGENT_FAILURE

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.getIdentities()).rejects.toThrow(
        'Agent returned failure for identities request',
      );
    });

    it('should throw error for unexpected response type', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const response = Buffer.from([99]); // Unexpected type

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.getIdentities()).rejects.toThrow('Unexpected response type: 99');
    });

    it('should timeout when agent does not respond', async () => {
      vi.useFakeTimers();
      try {
        agentProxy = new SSHAgentProxy(mockChannel as any);

        mockChannel.write.mockImplementation(() => {
          // Don't send any response, causing timeout
          return true;
        });

        const assertion = expect(agentProxy.getIdentities()).rejects.toThrow(
          'Agent request timeout',
        );
        await vi.advanceTimersByTimeAsync(10001);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it('should throw error for invalid identities response - too short', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const response = Buffer.from([12]); // SSH_AGENT_IDENTITIES_ANSWER but no data

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.getIdentities()).rejects.toThrow(
        'Invalid identities response: too short for key count',
      );
    });
  });

  describe('sign', () => {
    it('should request signature from agent', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const publicKeyBlob = Buffer.alloc(32, 0x41);
      const dataToSign = Buffer.from('data to sign');

      // Mock agent response for sign request
      // Format: [type:1][sig_blob_len:4][sig_blob]
      // sig_blob format: [algo_len:4][algo][sig_len:4][sig]
      const signature = Buffer.alloc(64, 0xab);
      const sigBlob = Buffer.concat([
        Buffer.from([0, 0, 0, 11]), // algo length
        Buffer.from('ssh-ed25519'), // algo
        Buffer.from([0, 0, 0, 64]), // sig length
        signature, // signature
      ]);

      const response = Buffer.concat([
        Buffer.from([14]), // SSH_AGENT_SIGN_RESPONSE
        Buffer.from([0, 0, 0, sigBlob.length]), // sig_blob_len
        sigBlob,
      ]);

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      const result = await agentProxy.sign(publicKeyBlob, dataToSign, 0);

      expect(result).toEqual(signature);
      expect(mockChannel.write).toHaveBeenCalled();
    });

    it('should throw error when agent returns failure for sign request', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const publicKeyBlob = Buffer.alloc(32, 0x41);
      const dataToSign = Buffer.from('data to sign');

      const response = Buffer.from([5]); // SSH_AGENT_FAILURE

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.sign(publicKeyBlob, dataToSign)).rejects.toThrow(
        'Agent returned failure for sign request',
      );
    });

    it('should throw error for invalid sign response - too short', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const publicKeyBlob = Buffer.alloc(32, 0x41);
      const dataToSign = Buffer.from('data to sign');

      const response = Buffer.from([14, 0, 0]); // Too short

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.sign(publicKeyBlob, dataToSign)).rejects.toThrow(
        'Invalid sign response: too short',
      );
    });

    it('should throw error for invalid signature blob - too short for algo length', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const publicKeyBlob = Buffer.alloc(32, 0x41);
      const dataToSign = Buffer.from('data to sign');

      const response = Buffer.concat([
        Buffer.from([14]), // SSH_AGENT_SIGN_RESPONSE
        Buffer.from([0, 0, 0, 2]), // sig_blob_len
        Buffer.from([0, 0]), // Too short signature blob
      ]);

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const messageLength = Buffer.allocUnsafe(4);
          messageLength.writeUInt32BE(response.length, 0);
          const fullMessage = Buffer.concat([messageLength, response]);
          mockChannel.emit('data', fullMessage);
        });
        return true;
      });

      await expect(agentProxy.sign(publicKeyBlob, dataToSign)).rejects.toThrow(
        'Invalid signature blob: too short for algo length',
      );
    });
  });

  describe('sign - edge cases', () => {
    function sendResponse(response: Buffer) {
      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const len = Buffer.allocUnsafe(4);
          len.writeUInt32BE(response.length, 0);
          mockChannel.emit('data', Buffer.concat([len, response]));
        });
        return true;
      });
    }

    const pubKey = Buffer.alloc(32, 0x41);
    const data = Buffer.from('data');

    it('should throw error for unexpected sign response type', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      sendResponse(Buffer.from([99]));

      await expect(agentProxy.sign(pubKey, data)).rejects.toThrow('Unexpected response type: 99');
    });

    it('should throw error for incomplete signature blob', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // sig_blob_len=100 but only 2 bytes of data
      sendResponse(
        Buffer.concat([Buffer.from([14]), Buffer.from([0, 0, 0, 100]), Buffer.from([0, 0])]),
      );

      await expect(agentProxy.sign(pubKey, data)).rejects.toThrow(
        'Invalid sign response: incomplete signature',
      );
    });

    it('should throw error when sig blob too short for algo and sig length', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // sigBlob: algoLen=3 + 'rsa' but no sig_len field after → total 7 bytes < 4+3+4=11
      const sigBlob = Buffer.concat([Buffer.from([0, 0, 0, 3]), Buffer.from('rsa')]);
      sendResponse(
        Buffer.concat([Buffer.from([14]), Buffer.from([0, 0, 0, sigBlob.length]), sigBlob]),
      );

      await expect(agentProxy.sign(pubKey, data)).rejects.toThrow(
        'Invalid signature blob: too short for algo and sig length',
      );
    });

    it('should throw error when signature bytes are incomplete', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // sigBlob: algoLen=3 + 'rsa' + sigLen=50 but only 1 byte of sig
      const sigBlob = Buffer.concat([
        Buffer.from([0, 0, 0, 3]),
        Buffer.from('rsa'),
        Buffer.from([0, 0, 0, 50]),
        Buffer.from([0x01]),
      ]);
      sendResponse(
        Buffer.concat([Buffer.from([14]), Buffer.from([0, 0, 0, sigBlob.length]), sigBlob]),
      );

      await expect(agentProxy.sign(pubKey, data)).rejects.toThrow(
        'Invalid signature blob: incomplete signature bytes',
      );
    });
  });

  describe('parseIdentities - edge cases', () => {
    function sendResponse(response: Buffer) {
      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          const len = Buffer.allocUnsafe(4);
          len.writeUInt32BE(response.length, 0);
          mockChannel.emit('data', Buffer.concat([len, response]));
        });
        return true;
      });
    }

    it('should throw when key blob length is missing', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // type=12 + num_keys=1 but no blob length
      sendResponse(Buffer.from([12, 0, 0, 0, 1]));

      await expect(agentProxy.getIdentities()).rejects.toThrow('missing key blob length for key 0');
    });

    it('should throw when key blob is incomplete', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // type=12 + num_keys=1 + blob_len=10 but only 2 bytes of blob
      sendResponse(Buffer.from([12, 0, 0, 0, 1, 0, 0, 0, 10, 0x41, 0x42]));

      await expect(agentProxy.getIdentities()).rejects.toThrow('incomplete key blob for key 0');
    });

    it('should throw when comment length is missing', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // type=12 + num_keys=1 + blob_len=2 + blob(2 bytes) but no comment_len
      sendResponse(Buffer.from([12, 0, 0, 0, 1, 0, 0, 0, 2, 0x41, 0x42]));

      await expect(agentProxy.getIdentities()).rejects.toThrow('missing comment length for key 0');
    });

    it('should throw when comment is incomplete', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // type=12 + num_keys=1 + blob_len=2 + blob + comment_len=10 + only 1 byte
      sendResponse(Buffer.from([12, 0, 0, 0, 1, 0, 0, 0, 2, 0x41, 0x42, 0, 0, 0, 10, 0x43]));

      await expect(agentProxy.getIdentities()).rejects.toThrow('incomplete comment for key 0');
    });

    it('should set algorithm to unknown when key blob is too short', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // key blob of 2 bytes (< 4, can't read algo length)
      const keyBlob = Buffer.from([0x01, 0x02]);
      sendResponse(
        Buffer.concat([
          Buffer.from([12, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, keyBlob.length]),
          keyBlob,
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('k'),
        ]),
      );

      const ids = await agentProxy.getIdentities();
      expect(ids[0].algorithm).toBe('unknown');
    });

    it('should set algorithm to unknown when algo data is incomplete', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      // key blob: algoLen=10 but only 1 byte of algo data
      const keyBlob = Buffer.from([0, 0, 0, 10, 0x41]);
      sendResponse(
        Buffer.concat([
          Buffer.from([12, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, keyBlob.length]),
          keyBlob,
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('k'),
        ]),
      );

      const ids = await agentProxy.getIdentities();
      expect(ids[0].algorithm).toBe('unknown');
    });
  });

  describe('handleMessage - edge cases', () => {
    it('should ignore empty messages from agent', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const validResponse = Buffer.from([12, 0, 0, 0, 0]); // empty identities

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          // Send empty message first (length=0)
          mockChannel.emit('data', Buffer.from([0, 0, 0, 0]));
          // Then send valid response
          setImmediate(() => {
            const len = Buffer.allocUnsafe(4);
            len.writeUInt32BE(validResponse.length, 0);
            mockChannel.emit('data', Buffer.concat([len, validResponse]));
          });
        });
        return true;
      });

      const ids = await agentProxy.getIdentities();
      expect(ids).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('should close channel and remove listeners', () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      agentProxy.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(agentProxy.listenerCount('close')).toBe(0);
      expect(agentProxy.listenerCount('error')).toBe(0);
    });

    it('should not close already destroyed channel', () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);
      mockChannel.destroyed = true;

      agentProxy.close();

      expect(mockChannel.close).not.toHaveBeenCalled();
    });
  });

  describe('buffer processing', () => {
    it('should accumulate partial messages', async () => {
      agentProxy = new SSHAgentProxy(mockChannel as any);

      const response = Buffer.from([12, 0, 0, 0, 0]); // Empty identities answer
      const messageLength = Buffer.allocUnsafe(4);
      messageLength.writeUInt32BE(response.length, 0);

      // Simulate receiving message in two parts
      const part1 = Buffer.concat([messageLength.slice(0, 2)]);
      const part2 = Buffer.concat([messageLength.slice(2), response]);

      mockChannel.write.mockImplementation(() => {
        setImmediate(() => {
          mockChannel.emit('data', part1);
          setImmediate(() => {
            mockChannel.emit('data', part2);
          });
        });
        return true;
      });

      const identities = await agentProxy.getIdentities();

      expect(identities).toHaveLength(0);
    });
  });
});
