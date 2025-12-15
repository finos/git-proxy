/**
 * SSH Agent Forwarding Implementation
 *
 * This module handles SSH agent forwarding, allowing the Git Proxy to use
 * the client's SSH agent to authenticate to remote Git servers without
 * ever receiving the private key.
 */

import { SSHAgentProxy } from './AgentProxy';
import { ClientWithUser } from './types';

// Import BaseAgent from ssh2 for custom agent implementation
const { BaseAgent } = require('ssh2/lib/agent.js');

/**
 * Lazy SSH Agent implementation that extends ssh2's BaseAgent.
 * Opens temporary agent channels on-demand when GitHub requests signatures.
 *
 * IMPORTANT: Agent operations are serialized to prevent channel ID conflicts.
 * Only one agent operation (getIdentities or sign) can be active at a time.
 */
export class LazySSHAgent extends BaseAgent {
  private openChannelFn: (client: ClientWithUser) => Promise<SSHAgentProxy | null>;
  private client: ClientWithUser;
  private operationChain: Promise<void> = Promise.resolve();

  constructor(
    openChannelFn: (client: ClientWithUser) => Promise<SSHAgentProxy | null>,
    client: ClientWithUser,
  ) {
    super();
    this.openChannelFn = openChannelFn;
    this.client = client;
  }

  /**
   * Execute an operation with exclusive lock using Promise chain.
   */
  private async executeWithLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationChain.then(
      () => operation(),
      () => operation(),
    );

    // Update chain to wait for this operation (but ignore result)
    this.operationChain = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  /**
   * Get list of identities from the client's forwarded agent
   */
  getIdentities(callback: (err: Error | null, keys?: any[]) => void): void {
    console.log('[LazyAgent] getIdentities called');

    // Wrap the operation in a lock to prevent concurrent channel usage
    this.executeWithLock(async () => {
      console.log('[LazyAgent] Lock acquired, opening temporary channel');
      let agentProxy: SSHAgentProxy | null = null;

      try {
        agentProxy = await this.openChannelFn(this.client);
        if (!agentProxy) {
          throw new Error('Could not open agent channel');
        }

        const identities = await agentProxy.getIdentities();
        console.log('[LazyAgent] Identities:', identities);
        console.log('--------------------------------');
        console.log('[LazyAgent] AgentProxy client details: ', {
          agentChannel: this.client.agentChannel,
          agentProxy: this.client.agentProxy,
          agentForwardingEnabled: this.client.agentForwardingEnabled,
          clientIp: this.client.clientIp,
          authenticatedUser: this.client.authenticatedUser,
        });

        // ssh2's AgentContext.init() calls parseKey() on every key we return.
        // We need to return the raw pubKeyBlob Buffer, which parseKey() can parse
        // into a proper ParsedKey object.
        const keys = identities.map((identity) => identity.publicKeyBlob);

        console.log(`[LazyAgent] Returning ${keys.length} identities`);

        // Close the temporary agent channel
        if (agentProxy) {
          agentProxy.close();
          console.log('[LazyAgent] Closed temporary agent channel after getIdentities');
        }

        callback(null, keys);
      } catch (err: any) {
        console.error('[LazyAgent] Error getting identities:', err);
        if (agentProxy) {
          agentProxy.close();
        }
        callback(err);
      }
    }).catch((err) => {
      console.error('[LazyAgent] Unexpected error in executeWithLock:', err);
      callback(err);
    });
  }

  /**
   * Sign data with a specific key using the client's forwarded agent
   */
  sign(
    pubKey: any,
    data: Buffer,
    options: any,
    callback?: (err: Error | null, signature?: Buffer) => void,
  ): void {
    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    }

    if (!callback) {
      callback = () => {};
    }

    console.log('[LazyAgent] sign called');

    // Wrap the operation in a lock to prevent concurrent channel usage
    this.executeWithLock(async () => {
      console.log('[LazyAgent] Lock acquired, opening temporary channel for signing');
      let agentProxy: SSHAgentProxy | null = null;

      try {
        agentProxy = await this.openChannelFn(this.client);
        if (!agentProxy) {
          throw new Error('Could not open agent channel');
        }
        let pubKeyBlob: Buffer;

        if (typeof pubKey.getPublicSSH === 'function') {
          pubKeyBlob = pubKey.getPublicSSH();
        } else if (Buffer.isBuffer(pubKey)) {
          pubKeyBlob = pubKey;
        } else {
          console.error('[LazyAgent] Unknown pubKey format:', Object.keys(pubKey || {}));
          throw new Error('Invalid pubKey format - cannot extract SSH wire format');
        }

        const signature = await agentProxy.sign(pubKeyBlob, data);
        console.log(`[LazyAgent] Signature received (${signature.length} bytes)`);

        if (agentProxy) {
          agentProxy.close();
          console.log('[LazyAgent] Closed temporary agent channel after sign');
        }

        callback!(null, signature);
      } catch (err: any) {
        console.error('[LazyAgent] Error signing data:', err);
        if (agentProxy) {
          agentProxy.close();
        }
        callback!(err);
      }
    }).catch((err) => {
      console.error('[LazyAgent] Unexpected error in executeWithLock:', err);
      callback!(err);
    });
  }
}

/**
 * Open a temporary agent channel to communicate with the client's forwarded agent
 * This channel is used for a single request and then closed
 *
 * IMPORTANT: This function manipulates ssh2 internals (_protocol, _chanMgr, _handlers)
 * because ssh2 does not expose a public API for opening agent channels from server side.
 *
 * @param client - The SSH client connection with agent forwarding enabled
 * @returns Promise resolving to an SSHAgentProxy or null if failed
 */
export async function openTemporaryAgentChannel(
  client: ClientWithUser,
): Promise<SSHAgentProxy | null> {
  // Access internal protocol handler (not exposed in public API)
  const proto = (client as any)._protocol;
  if (!proto) {
    console.error('[SSH] No protocol found on client connection');
    return null;
  }

  // Find next available channel ID by checking internal ChannelManager
  // This prevents conflicts with channels that ssh2 might be managing
  const chanMgr = (client as any)._chanMgr;
  let localChan = 1; // Start from 1 (0 is typically main session)

  if (chanMgr && chanMgr._channels) {
    // Find first available channel ID
    while (chanMgr._channels[localChan] !== undefined) {
      localChan++;
    }
  }

  console.log(`[SSH] Opening agent channel with ID ${localChan}`);

  return new Promise((resolve) => {
    const originalHandler = (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION;
    const handlerWrapper = (self: any, info: any) => {
      if (originalHandler) {
        originalHandler(self, info);
      }

      if (info.recipient === localChan) {
        clearTimeout(timeout);

        // Restore original handler
        if (originalHandler) {
          (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION = originalHandler;
        } else {
          delete (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION;
        }

        // Create a Channel object manually
        try {
          const channelInfo = {
            type: 'auth-agent@openssh.com',
            incoming: {
              id: info.sender,
              window: info.window,
              packetSize: info.packetSize,
              state: 'open',
            },
            outgoing: {
              id: localChan,
              window: 2 * 1024 * 1024, // 2MB default
              packetSize: 32 * 1024, // 32KB default
              state: 'open',
            },
          };

          const { Channel } = require('ssh2/lib/Channel');
          const channel = new Channel(client, channelInfo, { server: true });

          // Register channel with ChannelManager
          const chanMgr = (client as any)._chanMgr;
          if (chanMgr) {
            chanMgr._channels[localChan] = channel;
            chanMgr._count++;
          }

          // Create the agent proxy
          const agentProxy = new SSHAgentProxy(channel);
          resolve(agentProxy);
        } catch (err) {
          console.error('[SSH] Failed to create Channel/AgentProxy:', err);
          resolve(null);
        }
      }
    };

    // Install our handler
    (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION = handlerWrapper;

    const timeout = setTimeout(() => {
      console.error('[SSH] Timeout waiting for channel confirmation');
      if (originalHandler) {
        (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION = originalHandler;
      } else {
        delete (proto as any)._handlers.CHANNEL_OPEN_CONFIRMATION;
      }
      resolve(null);
    }, 5000);

    // Send the channel open request
    const { MAX_WINDOW, PACKET_SIZE } = require('ssh2/lib/Channel');
    proto.openssh_authAgent(localChan, MAX_WINDOW, PACKET_SIZE);
  });
}

/**
 * Create a "lazy" agent that opens channels on-demand when GitHub requests signatures
 *
 * @param client - The SSH client connection with agent forwarding enabled
 * @returns A LazySSHAgent instance
 */
export function createLazyAgent(client: ClientWithUser): LazySSHAgent {
  return new LazySSHAgent(openTemporaryAgentChannel, client);
}
