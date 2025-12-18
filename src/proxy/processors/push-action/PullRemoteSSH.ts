import { Action, Step } from '../../actions';
import { PullRemoteBase, CloneResult } from './PullRemoteBase';
import { ClientWithUser } from '../../ssh/types';
import { DEFAULT_KNOWN_HOSTS } from '../../ssh/knownHosts';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * SSH implementation of pull remote
 * Uses system git with SSH agent forwarding for cloning
 */
export class PullRemoteSSH extends PullRemoteBase {
  /**
   * Validate agent socket path to prevent command injection
   * Only allows safe characters in Unix socket paths
   */
  private validateAgentSocketPath(socketPath: string | undefined): string {
    if (!socketPath) {
      throw new Error(
        'SSH agent socket path not found. ' +
          'Ensure SSH_AUTH_SOCK is set or agent forwarding is enabled.',
      );
    }

    // Unix socket paths should only contain alphanumeric, dots, slashes, underscores, hyphens
    // and allow common socket path patterns like /tmp/ssh-*/agent.*
    const safePathRegex = /^[a-zA-Z0-9/_.\-*]+$/;
    if (!safePathRegex.test(socketPath)) {
      throw new Error(
        `Invalid SSH agent socket path: contains unsafe characters. Path: ${socketPath}`,
      );
    }

    // Additional validation: path should start with / (absolute path)
    if (!socketPath.startsWith('/')) {
      throw new Error(
        `Invalid SSH agent socket path: must be an absolute path. Path: ${socketPath}`,
      );
    }

    return socketPath;
  }

  /**
   * Create a secure known_hosts file with hardcoded verified host keys
   * This prevents MITM attacks by using pre-verified fingerprints
   *
   * NOTE: We use hardcoded fingerprints from DEFAULT_KNOWN_HOSTS, NOT ssh-keyscan,
   * because ssh-keyscan itself is vulnerable to MITM attacks.
   */
  private async createKnownHostsFile(tempDir: string, sshUrl: string): Promise<string> {
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
      if (keyParts.length < 2) {
        throw new Error('Invalid ssh-keyscan output format');
      }

      const publicKeyBase64 = keyParts[1];
      const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

      // Calculate SHA256 fingerprint
      const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('base64');
      const calculatedFingerprint = `SHA256:${hash}`;

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
   * Convert HTTPS URL to SSH URL
   */
  private convertToSSHUrl(httpsUrl: string): string {
    // Convert https://github.com/org/repo.git to git@github.com:org/repo.git
    const match = httpsUrl.match(/https:\/\/([^/]+)\/(.+)/);
    if (!match) {
      throw new Error(`Invalid repository URL: ${httpsUrl}`);
    }

    const [, host, repoPath] = match;
    return `git@${host}:${repoPath}`;
  }

  /**
   * Clone repository using system git with SSH agent forwarding
   * Implements secure SSH configuration with host key verification
   */
  private async cloneWithSystemGit(
    client: ClientWithUser,
    action: Action,
    step: Step,
  ): Promise<void> {
    const sshUrl = this.convertToSSHUrl(action.url);

    // Create parent directory
    await fs.promises.mkdir(action.proxyGitPath!, { recursive: true });

    step.log(`Cloning repository via system git: ${sshUrl}`);

    // Create temporary directory for SSH config and known_hosts
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-'));
    const sshConfigPath = path.join(tempDir, 'ssh_config');

    try {
      // Validate and get the agent socket path
      const rawAgentSocketPath = (client as any)._agent?._sock?.path || process.env.SSH_AUTH_SOCK;
      const agentSocketPath = this.validateAgentSocketPath(rawAgentSocketPath);

      step.log(`Using SSH agent socket: ${agentSocketPath}`);

      // Create secure known_hosts file with verified host keys
      const knownHostsPath = await this.createKnownHostsFile(tempDir, sshUrl);
      step.log(`Created secure known_hosts file with verified host keys`);

      // Create secure SSH config with StrictHostKeyChecking enabled
      const sshConfig = `Host *
  StrictHostKeyChecking yes
  UserKnownHostsFile ${knownHostsPath}
  IdentityAgent ${agentSocketPath}
  # Additional security settings
  HashKnownHosts no
  PasswordAuthentication no
  PubkeyAuthentication yes
`;

      await fs.promises.writeFile(sshConfigPath, sshConfig, { mode: 0o600 });

      await new Promise<void>((resolve, reject) => {
        const gitProc = spawn(
          'git',
          ['clone', '--depth', '1', '--single-branch', '--', sshUrl, action.repoName],
          {
            cwd: action.proxyGitPath,
            env: {
              ...process.env,
              GIT_SSH_COMMAND: `ssh -F "${sshConfigPath}"`,
            },
          },
        );

        let stderr = '';
        let stdout = '';

        gitProc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        gitProc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        gitProc.on('close', (code) => {
          if (code === 0) {
            step.log(`Successfully cloned repository (depth=1) with secure SSH verification`);
            resolve();
          } else {
            reject(
              new Error(
                `git clone failed (code ${code}): ${stderr}\n` +
                  `This may indicate a host key verification failure or network issue.`,
              ),
            );
          }
        });

        gitProc.on('error', (err) => {
          reject(new Error(`Failed to spawn git: ${err.message}`));
        });
      });
    } finally {
      // Cleanup temp SSH config and known_hosts
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Perform SSH clone
   */
  protected async performClone(req: any, action: Action, step: Step): Promise<CloneResult> {
    const client: ClientWithUser = req.sshClient;

    if (!client) {
      throw new Error('No SSH client available for SSH clone');
    }

    if (!client.agentForwardingEnabled) {
      throw new Error(
        'SSH clone requires agent forwarding. ' +
          'Ensure the client is connected with agent forwarding enabled.',
      );
    }

    step.log('Cloning repository over SSH using agent forwarding');

    try {
      await this.cloneWithSystemGit(client, action, step);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SSH clone failed: ${message}`);
    }

    const sshUrl = this.convertToSSHUrl(action.url);

    return {
      command: `git clone --depth 1 ${sshUrl}`,
      strategy: 'ssh-agent-forwarding',
    };
  }
}
