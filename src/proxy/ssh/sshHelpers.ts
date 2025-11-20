import { getProxyUrl } from '../../config';
import { KILOBYTE, MEGABYTE } from '../../constants';
import { ClientWithUser } from './types';
import { createLazyAgent } from './AgentForwarding';

/**
 * Validate prerequisites for SSH connection to remote
 * Throws descriptive errors if requirements are not met
 */
export function validateSSHPrerequisites(client: ClientWithUser): void {
  // Check proxy URL
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    throw new Error('No proxy URL configured');
  }

  // Check agent forwarding
  if (!client.agentForwardingEnabled) {
    throw new Error(
      'SSH agent forwarding is required. Please connect with: ssh -A\n' +
        'Or configure ~/.ssh/config with: ForwardAgent yes',
    );
  }
}

/**
 * Create SSH connection options for connecting to remote Git server
 * Includes agent forwarding, algorithms, timeouts, etc.
 */
export function createSSHConnectionOptions(
  client: ClientWithUser,
  options?: {
    debug?: boolean;
    keepalive?: boolean;
  },
): any {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    throw new Error('No proxy URL configured');
  }

  const remoteUrl = new URL(proxyUrl);
  const customAgent = createLazyAgent(client);

  const connectionOptions: any = {
    host: remoteUrl.hostname,
    port: 22,
    username: 'git',
    tryKeyboard: false,
    readyTimeout: 30000,
    agent: customAgent,
    algorithms: {
      kex: [
        'ecdh-sha2-nistp256' as any,
        'ecdh-sha2-nistp384' as any,
        'ecdh-sha2-nistp521' as any,
        'diffie-hellman-group14-sha256' as any,
        'diffie-hellman-group16-sha512' as any,
        'diffie-hellman-group18-sha512' as any,
      ],
      serverHostKey: ['rsa-sha2-512' as any, 'rsa-sha2-256' as any, 'ssh-rsa' as any],
      cipher: ['aes128-gcm' as any, 'aes256-gcm' as any, 'aes128-ctr' as any, 'aes256-ctr' as any],
      hmac: ['hmac-sha2-256' as any, 'hmac-sha2-512' as any],
    },
  };

  if (options?.keepalive) {
    connectionOptions.keepaliveInterval = 15000;
    connectionOptions.keepaliveCountMax = 5;
    connectionOptions.windowSize = 1 * MEGABYTE;
    connectionOptions.packetSize = 32 * KILOBYTE;
  }

  if (options?.debug) {
    connectionOptions.debug = (msg: string) => {
      console.debug('[GitHub SSH Debug]', msg);
    };
  }

  return connectionOptions;
}

/**
 * Create a mock response object for security chain validation
 * This is used when SSH operations need to go through the proxy chain
 */
export function createMockResponse(): any {
  return {
    headers: {},
    statusCode: 200,
    set: function (headers: any) {
      Object.assign(this.headers, headers);
      return this;
    },
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    send: function () {
      return this;
    },
  };
}
