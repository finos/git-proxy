import { getProxyUrl, getSSHConfig } from '../../config';
import { KILOBYTE, MEGABYTE } from '../../constants';
import { ClientWithUser } from './types';
import { createLazyAgent } from './AgentForwarding';

/**
 * Default error message for missing agent forwarding
 */
const DEFAULT_AGENT_FORWARDING_ERROR =
  'SSH agent forwarding is required.\n\n' +
  'Configure it for this repository:\n' +
  '  git config core.sshCommand "ssh -A"\n\n' +
  'Or globally for all repositories:\n' +
  '  git config --global core.sshCommand "ssh -A"\n\n' +
  'Note: Configuring per-repository is more secure than using --global.';

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
    const sshConfig = getSSHConfig();
    const customMessage = sshConfig?.agentForwardingErrorMessage;
    const errorMessage = customMessage || DEFAULT_AGENT_FORWARDING_ERROR;

    throw new Error(errorMessage);
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
