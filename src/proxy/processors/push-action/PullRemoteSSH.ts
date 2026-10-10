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

import { Action, Step } from '../../actions';
import { PullRemoteBase, CloneResult, RemoteAccess } from './PullRemoteBase';
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

    const access = await this.prepareRemoteAccess({ sshClient: client }, action, step);
    const sshCommand = access.env!.GIT_SSH_COMMAND;

    try {
      await new Promise<void>((resolve, reject) => {
        const gitProc = spawn(
          'git',
          ['clone', '--depth', '1', '--single-branch', '--', sshUrl, action.repoName],
          {
            cwd: action.proxyGitPath,
            env: {
              ...process.env,
              GIT_SSH_COMMAND: sshCommand,
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
      await access.cleanup!();
    }
  }

  /**
   * Describe how native git should reach the remote over SSH.
   *
   * Writes a temporary ssh_config that pins the verified host keys and points
   * ssh at the client's forwarded agent, and hands back the GIT_SSH_COMMAND
   * that makes git use it. The caller must invoke `cleanup` when done.
   *
   * @param req Request-like object carrying the SSH client
   * @param action Action object
   * @param step Step for logging
   * @return Remote access descriptor carrying GIT_SSH_COMMAND and a cleanup
   */
  protected async prepareRemoteAccess(req: any, action: Action, step: Step): Promise<RemoteAccess> {
    const client: ClientWithUser = req.sshClient;
    const sshUrl = convertToSSHUrl(action.url);

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-'));
    const sshConfigPath = path.join(tempDir, 'ssh_config');
    const cleanup = async () => {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    };

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
    } catch (error) {
      // Nothing downstream can call cleanup if we never return the descriptor
      await cleanup();
      throw error;
    }

    return {
      url: sshUrl,
      env: { GIT_SSH_COMMAND: `ssh -F "${sshConfigPath}"` },
      cleanup,
    };
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
