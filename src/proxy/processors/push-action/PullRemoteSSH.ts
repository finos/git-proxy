import { Action, Step } from '../../actions';
import { PullRemoteBase, CloneResult } from './PullRemoteBase';
import { ClientWithUser } from '../../ssh/types';
import {
  validateAgentSocketPath,
  convertToSSHUrl,
  createKnownHostsFile,
} from '../../ssh/sshHelpers';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * SSH implementation of pull remote
 * Uses system git with SSH agent forwarding for cloning
 */
export class PullRemoteSSH extends PullRemoteBase {
  /**
   * Clone repository using system git with SSH agent forwarding
   * Implements secure SSH configuration with host key verification
   */
  private async cloneWithSystemGit(
    client: ClientWithUser,
    action: Action,
    step: Step,
  ): Promise<void> {
    const sshUrl = convertToSSHUrl(action.url);

    // Create parent directory
    await fs.promises.mkdir(action.proxyGitPath!, { recursive: true });

    step.log(`Cloning repository via system git: ${sshUrl}`);

    // Create temporary directory for SSH config and known_hosts
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-'));
    const sshConfigPath = path.join(tempDir, 'ssh_config');

    try {
      // Validate and get the agent socket path
      const rawAgentSocketPath = (client as any)._agent?._sock?.path || process.env.SSH_AUTH_SOCK;
      const agentSocketPath = validateAgentSocketPath(rawAgentSocketPath);

      step.log(`Using SSH agent socket: ${agentSocketPath}`);

      // Create secure known_hosts file with verified host keys
      const knownHostsPath = await createKnownHostsFile(tempDir, sshUrl);
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

    const sshUrl = convertToSSHUrl(action.url);

    return {
      command: `git clone --depth 1 ${sshUrl}`,
      strategy: 'ssh-agent-forwarding',
    };
  }
}
