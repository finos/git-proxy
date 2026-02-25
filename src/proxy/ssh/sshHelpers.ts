import { getSSHConfig } from '../../config';
import { KILOBYTE, MEGABYTE } from '../../constants';
import { ClientWithUser } from './types';
import { createLazyAgent } from './AgentForwarding';
import { getKnownHosts, verifyHostKey, DEFAULT_KNOWN_HOSTS } from './knownHosts';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Calculate SHA-256 fingerprint from SSH host key Buffer
 */
function calculateHostKeyFingerprint(keyBuffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(keyBuffer).digest('base64');
  // Remove base64 padding to match SSH fingerprint standard format
  const hashWithoutPadding = hash.replace(/=+$/, '');
  return `SHA256:${hashWithoutPadding}`;
}

/**
 * Default error message for missing agent forwarding
 */
const DEFAULT_AGENT_FORWARDING_ERROR =
  'SSH agent forwarding is required.\n\n' +
  'Why? The proxy uses your SSH keys (via agent forwarding) to authenticate\n' +
  'with GitHub/GitLab. Your keys never leave your machine - the proxy just\n' +
  'forwards authentication requests to your local SSH agent.\n\n' +
  'To enable agent forwarding for this repository:\n' +
  '  git config core.sshCommand "ssh -A"\n\n' +
  'Or globally for all repositories:\n' +
  '  git config --global core.sshCommand "ssh -A"\n\n' +
  'Also ensure SSH agent is running and keys are loaded:\n' +
  '  # Start ssh-agent if not running\n' +
  '  eval $(ssh-agent -s)\n\n' +
  '  # Add your SSH key\n' +
  '  ssh-add ~/.ssh/id_ed25519\n\n' +
  '  # Verify key is loaded\n' +
  '  ssh-add -l\n\n' +
  'Note: Per-repository config is more secure than --global.';

/**
 * Validate prerequisites for SSH connection to remote
 * Throws descriptive errors if requirements are not met
 */
export function validateSSHPrerequisites(client: ClientWithUser): void {
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
  remoteHost: string,
  options?: {
    debug?: boolean;
    keepalive?: boolean;
  },
): any {
  const sshConfig = getSSHConfig();
  const knownHosts = getKnownHosts(sshConfig?.knownHosts);

  const connectionOptions: any = {
    host: remoteHost,
    port: 22,
    username: 'git',
    tryKeyboard: false,
    readyTimeout: 30000,
    hostVerifier: (keyHash: Buffer | string, callback: (valid: boolean) => void) => {
      // ssh2 passes the raw key as a Buffer, calculate SHA256 fingerprint
      const fingerprint = Buffer.isBuffer(keyHash) ? calculateHostKeyFingerprint(keyHash) : keyHash;

      console.log(`[SSH] Verifying host key for ${remoteHost}: ${fingerprint}`);

      const isValid = verifyHostKey(remoteHost, fingerprint, knownHosts);

      if (isValid) {
        console.log(`[SSH] Host key verification successful for ${remoteHost}`);
      }

      callback(isValid);
    },
  };

  if (client.agentForwardingEnabled) {
    connectionOptions.agent = createLazyAgent(client);
  }

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
 * Create a known_hosts file with verified SSH host keys
 * Fetches the actual host key and verifies it against hardcoded fingerprints
 *
 * This prevents MITM attacks by using pre-verified fingerprints
 *
 * @param tempDir Temporary directory to create the known_hosts file in
 * @param sshUrl SSH URL (e.g., git@github.com:org/repo.git)
 * @returns Path to the created known_hosts file
 */
export async function createKnownHostsFile(tempDir: string, sshUrl: string): Promise<string> {
  const knownHostsPath = path.join(tempDir, 'known_hosts');

  // Extract hostname from SSH URL (git@github.com:org/repo.git -> github.com)
  const hostMatch = sshUrl.match(/git@([^:]+):/);
  if (!hostMatch) {
    throw new Error(`Cannot extract hostname from SSH URL: ${sshUrl}`);
  }

  const hostname = hostMatch[1];

  // Get the known host key for this hostname from hardcoded fingerprints
  const knownFingerprint = DEFAULT_KNOWN_HOSTS[hostname];
  if (!knownFingerprint) {
    throw new Error(
      `No known host key for ${hostname}. ` +
        `Supported hosts: ${Object.keys(DEFAULT_KNOWN_HOSTS).join(', ')}. ` +
        `To add support for ${hostname}, add its ed25519 key fingerprint to DEFAULT_KNOWN_HOSTS.`,
    );
  }

  // Fetch the actual host key from the remote server to get the public key
  // We'll verify its fingerprint matches our hardcoded one
  let actualHostKey: string;
  try {
    const output = execSync(`ssh-keyscan -t ed25519 ${hostname} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    // Parse ssh-keyscan output: "hostname ssh-ed25519 AAAAC3Nz..."
    const keyLine = output.split('\n').find((line) => line.includes('ssh-ed25519'));
    if (!keyLine) {
      throw new Error('No ed25519 key found in ssh-keyscan output');
    }

    actualHostKey = keyLine.trim();

    // Verify the fingerprint matches our hardcoded trusted fingerprint
    // Extract the public key portion
    const keyParts = actualHostKey.split(' ');
    if (keyParts.length < 3) {
      throw new Error('Invalid ssh-keyscan output format');
    }

    const publicKeyBase64 = keyParts[2];
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

    // Calculate SHA256 fingerprint
    const calculatedFingerprint = calculateHostKeyFingerprint(publicKeyBuffer);

    // Verify against hardcoded fingerprint
    if (calculatedFingerprint !== knownFingerprint) {
      throw new Error(
        `Host key verification failed for ${hostname}!\n` +
          `Expected fingerprint: ${knownFingerprint}\n` +
          `Received fingerprint: ${calculatedFingerprint}\n` +
          `WARNING: This could indicate a man-in-the-middle attack!\n` +
          `If the host key has legitimately changed, update DEFAULT_KNOWN_HOSTS.`,
      );
    }

    console.log(`[SSH] ✓ Host key verification successful for ${hostname}`);
    console.log(`[SSH]   Fingerprint: ${calculatedFingerprint}`);
  } catch (error) {
    throw new Error(
      `Failed to verify host key for ${hostname}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Write the verified known_hosts file
  await fs.promises.writeFile(knownHostsPath, actualHostKey + '\n', { mode: 0o600 });

  return knownHostsPath;
}

/**
 * Validate SSH agent socket path for security
 * Ensures the path is absolute and contains no unsafe characters
 */
export function validateAgentSocketPath(socketPath: string | undefined): string {
  if (!socketPath) {
    throw new Error(
      'SSH agent socket path not found. Ensure SSH agent is running and SSH_AUTH_SOCK is set.',
    );
  }

  // Security: Prevent path traversal and command injection
  // Allow only alphanumeric, dash, underscore, dot, forward slash
  const unsafeCharPattern = /[^a-zA-Z0-9\-_./]/;
  if (unsafeCharPattern.test(socketPath)) {
    throw new Error('Invalid SSH agent socket path: contains unsafe characters');
  }

  // Ensure it's an absolute path
  if (!socketPath.startsWith('/')) {
    throw new Error('Invalid SSH agent socket path: must be an absolute path');
  }

  return socketPath;
}

/**
 * Convert HTTPS Git URL to SSH format
 * Example: https://github.com/org/repo.git -> git@github.com:org/repo.git
 */
export function convertToSSHUrl(httpsUrl: string): string {
  try {
    const url = new URL(httpsUrl);
    const hostname = url.hostname;
    const pathname = url.pathname.replace(/^\//, ''); // Remove leading slash

    return `git@${hostname}:${pathname}`;
  } catch (error) {
    throw new Error(`Invalid repository URL: ${httpsUrl}`);
  }
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
