import { Action, Step } from '../../actions';
import { PullRemoteBase, CloneResult } from './PullRemoteBase';
import { ClientWithUser } from '../../ssh/types';
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

    // Create temporary SSH config to use proxy's agent socket
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-'));
    const sshConfigPath = path.join(tempDir, 'ssh_config');

    // Get the agent socket path from the client connection
    const agentSocketPath = (client as any)._agent?._sock?.path || process.env.SSH_AUTH_SOCK;

    const sshConfig = `Host *
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
  IdentityAgent ${agentSocketPath}
`;

    await fs.promises.writeFile(sshConfigPath, sshConfig);

    try {
      await new Promise<void>((resolve, reject) => {
        const gitProc = spawn(
          'git',
          ['clone', '--depth', '1', '--single-branch', sshUrl, action.repoName],
          {
            cwd: action.proxyGitPath,
            env: {
              ...process.env,
              GIT_SSH_COMMAND: `ssh -F ${sshConfigPath}`,
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
            step.log(`Successfully cloned repository (depth=1)`);
            resolve();
          } else {
            reject(new Error(`git clone failed (code ${code}): ${stderr}`));
          }
        });

        gitProc.on('error', (err) => {
          reject(new Error(`Failed to spawn git: ${err.message}`));
        });
      });
    } finally {
      // Cleanup temp SSH config
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
