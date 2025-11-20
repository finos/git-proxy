import * as ssh2 from 'ssh2';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import { getSSHConfig, getMaxPackSizeBytes, getDomains } from '../../config';
import { serverConfig } from '../../config/env';
import chain from '../chain';
import * as db from '../../db';
import { Action } from '../actions';

import {
  fetchGitHubCapabilities,
  forwardPackDataToRemote,
  connectToRemoteGitServer,
} from './GitProtocol';
import { ClientWithUser } from './types';
import { createMockResponse } from './sshHelpers';

export class SSHServer {
  private server: ssh2.Server;

  constructor() {
    const sshConfig = getSSHConfig();
    const privateKeys: Buffer[] = [];

    try {
      privateKeys.push(fs.readFileSync(sshConfig.hostKey.privateKeyPath));
    } catch (error) {
      console.error(
        `Error reading private key at ${sshConfig.hostKey.privateKeyPath}. Check your SSH host key configuration or disbale SSH.`,
      );
      process.exit(1);
    }

    // TODO: Server config could go to config file
    this.server = new ssh2.Server(
      {
        hostKeys: privateKeys,
        authMethods: ['publickey', 'password'] as any,
        keepaliveInterval: 20000, // 20 seconds is recommended for SSH connections
        keepaliveCountMax: 5, // Recommended for SSH connections is 3-5 attempts
        readyTimeout: 30000, // Longer ready timeout
        debug: (msg: string) => {
          console.debug('[SSH Debug]', msg);
        },
      } as any, // Cast to any to avoid strict type checking for now
      (client: ssh2.Connection, info: any) => {
        // Pass client connection info to the handler
        this.handleClient(client, { ip: info?.ip, family: info?.family });
      },
    );
  }

  private resolveHostHeader(): string {
    const port = Number(serverConfig.GIT_PROXY_SERVER_PORT) || 8000;
    const domains = getDomains();

    // Try service domain first, then UI host
    const rawHost = domains?.service || serverConfig.GIT_PROXY_UI_HOST || 'localhost';

    const cleanHost = rawHost
      .replace(/^https?:\/\//, '') // Remove protocol
      .split('/')[0] // Remove path
      .split(':')[0]; // Remove port

    return `${cleanHost}:${port}`;
  }

  private buildAuthContext(client: ClientWithUser) {
    return {
      protocol: 'ssh' as const,
      username: client.authenticatedUser?.username,
      email: client.authenticatedUser?.email,
      gitAccount: client.authenticatedUser?.gitAccount,
      clientIp: client.clientIp,
      agentForwardingEnabled: client.agentForwardingEnabled || false,
    };
  }

  /**
   * Create a mock request object for security chain validation
   */
  private createChainRequest(
    repoPath: string,
    gitPath: string,
    client: ClientWithUser,
    method: 'GET' | 'POST',
    packData?: Buffer | null,
  ): any {
    const hostHeader = this.resolveHostHeader();
    const contentType =
      method === 'POST'
        ? 'application/x-git-receive-pack-request'
        : 'application/x-git-upload-pack-request';

    return {
      originalUrl: `/${repoPath}/${gitPath}`,
      url: `/${repoPath}/${gitPath}`,
      method,
      headers: {
        'user-agent': 'git/ssh-proxy',
        'content-type': contentType,
        host: hostHeader,
        ...(packData && { 'content-length': packData.length.toString() }),
        'x-forwarded-proto': 'https',
        'x-forwarded-host': hostHeader,
      },
      body: packData || null,
      bodyRaw: packData || null,
      user: client.authenticatedUser || null,
      isSSH: true,
      protocol: 'ssh' as const,
      sshUser: {
        username: client.authenticatedUser?.username || 'unknown',
        email: client.authenticatedUser?.email,
        gitAccount: client.authenticatedUser?.gitAccount,
      },
      authContext: this.buildAuthContext(client),
    };
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return `${bytes} bytes`;
    }

    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    const precision = unitIndex === 0 ? 0 : 2;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
  }

  async handleClient(
    client: ssh2.Connection,
    clientInfo?: { ip?: string; family?: string },
  ): Promise<void> {
    const clientIp = clientInfo?.ip || 'unknown';
    console.log(`[SSH] Client connected from ${clientIp}`);
    const clientWithUser = client as ClientWithUser;
    clientWithUser.clientIp = clientIp;

    const connectionTimeout = setTimeout(() => {
      console.log(`[SSH] Connection timeout for ${clientIp} - closing`);
      client.end();
    }, 600000); // 10 minute timeout

    client.on('error', (err: Error) => {
      console.error(`[SSH] Client error from ${clientIp}:`, err);
      clearTimeout(connectionTimeout);
    });

    client.on('end', () => {
      console.log(`[SSH] Client disconnected from ${clientIp}`);
      clearTimeout(connectionTimeout);
    });

    client.on('close', () => {
      console.log(`[SSH] Client connection closed from ${clientIp}`);
      clearTimeout(connectionTimeout);
    });

    (client as any).on('global request', (accept: () => void, reject: () => void, info: any) => {
      if (info.type === 'keepalive@openssh.com') {
        accept();
      } else {
        reject();
      }
    });

    client.on('authentication', (ctx: ssh2.AuthContext) => {
      console.log(
        `[SSH] Authentication attempt from ${clientIp}:`,
        ctx.method,
        'for user:',
        ctx.username,
      );

      if (ctx.method === 'publickey') {
        const keyString = `${ctx.key.algo} ${ctx.key.data.toString('base64')}`;

        (db as any)
          .findUserBySSHKey(keyString)
          .then((user: any) => {
            if (user) {
              console.log(
                `[SSH] Public key authentication successful for user: ${user.username} from ${clientIp}`,
              );
              clientWithUser.authenticatedUser = {
                username: user.username,
                email: user.email,
                gitAccount: user.gitAccount,
              };
              ctx.accept();
            } else {
              console.log('[SSH] Public key authentication failed - key not found');
              ctx.reject();
            }
          })
          .catch((err: Error) => {
            console.error('[SSH] Database error during public key auth:', err);
            ctx.reject();
          });
      } else if (ctx.method === 'password') {
        db.findUser(ctx.username)
          .then((user) => {
            if (user && user.password) {
              bcrypt.compare(
                ctx.password,
                user.password || '',
                (err: Error | null, result?: boolean) => {
                  if (err) {
                    console.error('[SSH] Error comparing password:', err);
                    ctx.reject();
                  } else if (result) {
                    console.log(
                      `[SSH] Password authentication successful for user: ${user.username} from ${clientIp}`,
                    );
                    clientWithUser.authenticatedUser = {
                      username: user.username,
                      email: user.email,
                      gitAccount: user.gitAccount,
                    };
                    ctx.accept();
                  } else {
                    console.log('[SSH] Password authentication failed - invalid password');
                    ctx.reject();
                  }
                },
              );
            } else {
              console.log('[SSH] Password authentication failed - user not found or no password');
              ctx.reject();
            }
          })
          .catch((err: Error) => {
            console.error('[SSH] Database error during password auth:', err);
            ctx.reject();
          });
      } else {
        console.log('[SSH] Unsupported authentication method:', ctx.method);
        ctx.reject();
      }
    });

    client.on('ready', () => {
      console.log(
        `[SSH] Client ready from ${clientIp}, user: ${clientWithUser.authenticatedUser?.username || 'unknown'}`,
      );
      clearTimeout(connectionTimeout);
    });

    client.on('session', (accept: () => ssh2.ServerChannel, reject: () => void) => {
      const session = accept();

      session.on(
        'exec',
        (accept: () => ssh2.ServerChannel, reject: () => void, info: { command: string }) => {
          const stream = accept();
          this.handleCommand(info.command, stream, clientWithUser);
        },
      );

      // Handle SSH agent forwarding requests
      // ssh2 emits 'auth-agent' event
      session.on('auth-agent', (...args: any[]) => {
        const accept = args[0];

        if (typeof accept === 'function') {
          accept();
        } else {
          // Client sent wantReply=false, manually send CHANNEL_SUCCESS
          try {
            const channelInfo = (session as any)._chanInfo;
            if (channelInfo && channelInfo.outgoing && channelInfo.outgoing.id !== undefined) {
              const proto = (client as any)._protocol || (client as any)._sock;
              if (proto && typeof proto.channelSuccess === 'function') {
                proto.channelSuccess(channelInfo.outgoing.id);
              }
            }
          } catch (err) {
            console.error('[SSH] Failed to send CHANNEL_SUCCESS:', err);
          }
        }

        clientWithUser.agentForwardingEnabled = true;
        console.log('[SSH] Agent forwarding enabled');
      });
    });
  }

  public async handleCommand(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
  ): Promise<void> {
    const userName = client.authenticatedUser?.username || 'unknown';
    const clientIp = client.clientIp || 'unknown';
    console.log(`[SSH] Handling command from ${userName}@${clientIp}: ${command}`);

    if (!client.authenticatedUser) {
      console.error(`[SSH] Unauthenticated command attempt from ${clientIp}`);
      stream.stderr.write('Authentication required\n');
      stream.exit(1);
      stream.end();
      return;
    }

    try {
      if (command.startsWith('git-upload-pack') || command.startsWith('git-receive-pack')) {
        await this.handleGitCommand(command, stream, client);
      } else {
        console.log(`[SSH] Unsupported command from ${userName}@${clientIp}: ${command}`);
        stream.stderr.write(`Unsupported command: ${command}\n`);
        stream.exit(1);
        stream.end();
      }
    } catch (error) {
      console.error(`[SSH] Error handling command from ${userName}@${clientIp}:`, error);
      stream.stderr.write(`Error: ${error}\n`);
      stream.exit(1);
      stream.end();
    }
  }

  private async handleGitCommand(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
  ): Promise<void> {
    try {
      // Extract repository path from command
      const repoMatch = command.match(/git-(?:upload-pack|receive-pack)\s+'?([^']+)'?/);
      if (!repoMatch) {
        throw new Error('Invalid Git command format');
      }

      let repoPath = repoMatch[1];
      // Remove leading slash if present to avoid double slashes in URL construction
      if (repoPath.startsWith('/')) {
        repoPath = repoPath.substring(1);
      }
      const isReceivePack = command.includes('git-receive-pack');
      const gitPath = isReceivePack ? 'git-receive-pack' : 'git-upload-pack';

      console.log(
        `[SSH] Git command for repository: ${repoPath} from user: ${client.authenticatedUser?.username || 'unknown'}`,
      );

      if (isReceivePack) {
        await this.handlePushOperation(command, stream, client, repoPath, gitPath);
      } else {
        await this.handlePullOperation(command, stream, client, repoPath, gitPath);
      }
    } catch (error) {
      console.error('[SSH] Error in Git command handling:', error);
      stream.stderr.write(`Error: ${error}\n`);
      stream.exit(1);
      stream.end();
    }
  }

  private async handlePushOperation(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
    repoPath: string,
    gitPath: string,
  ): Promise<void> {
    console.log(
      `[SSH] Handling push operation for ${repoPath} (secure mode: validate BEFORE sending to GitHub)`,
    );

    const maxPackSize = getMaxPackSizeBytes();
    const maxPackSizeDisplay = this.formatBytes(maxPackSize);
    const userName = client.authenticatedUser?.username || 'unknown';

    const capabilities = await fetchGitHubCapabilities(command, client);
    stream.write(capabilities);

    const packDataChunks: Buffer[] = [];
    let totalBytes = 0;

    // Set up data capture from client stream
    const dataHandler = (data: Buffer) => {
      try {
        if (!Buffer.isBuffer(data)) {
          console.error(`[SSH] Invalid data type received: ${typeof data}`);
          stream.stderr.write('Error: Invalid data format received\n');
          stream.exit(1);
          stream.end();
          return;
        }

        if (totalBytes + data.length > maxPackSize) {
          const attemptedSize = totalBytes + data.length;
          console.error(
            `[SSH] Pack size limit exceeded: ${attemptedSize} (${this.formatBytes(attemptedSize)}) > ${maxPackSize} (${maxPackSizeDisplay})`,
          );
          stream.stderr.write(
            `Error: Pack data exceeds maximum size limit (${maxPackSizeDisplay})\n`,
          );
          stream.exit(1);
          stream.end();
          return;
        }

        packDataChunks.push(data);
        totalBytes += data.length;
        // NOTE: Data is buffered, NOT sent to GitHub yet
      } catch (error) {
        console.error(`[SSH] Error processing data chunk:`, error);
        stream.stderr.write(`Error: Failed to process data chunk: ${error}\n`);
        stream.exit(1);
        stream.end();
      }
    };

    const endHandler = async () => {
      console.log(`[SSH] Received ${totalBytes} bytes, validating with security chain`);

      try {
        if (packDataChunks.length === 0 && totalBytes === 0) {
          console.warn(`[SSH] No pack data received for push operation`);
          // Allow empty pushes (e.g., tag creation without commits)
          stream.exit(0);
          stream.end();
          return;
        }

        let packData: Buffer | null = null;
        try {
          packData = packDataChunks.length > 0 ? Buffer.concat(packDataChunks) : null;

          // Verify concatenated data integrity
          if (packData && packData.length !== totalBytes) {
            throw new Error(
              `Pack data corruption detected: expected ${totalBytes} bytes, got ${packData.length} bytes`,
            );
          }
        } catch (concatError) {
          console.error(`[SSH] Error concatenating pack data:`, concatError);
          stream.stderr.write(`Error: Failed to process pack data: ${concatError}\n`);
          stream.exit(1);
          stream.end();
          return;
        }

        // Validate with security chain BEFORE sending to GitHub
        const req = this.createChainRequest(repoPath, gitPath, client, 'POST', packData);
        const res = createMockResponse();

        // Execute the proxy chain with captured pack data
        let chainResult: Action;
        try {
          chainResult = await chain.executeChain(req, res);
        } catch (chainExecError) {
          console.error(`[SSH] Chain execution threw error:`, chainExecError);
          throw new Error(`Security chain execution failed: ${chainExecError}`);
        }

        if (chainResult.error || chainResult.blocked) {
          const message =
            chainResult.errorMessage ||
            chainResult.blockedMessage ||
            'Request blocked by proxy chain';
          throw new Error(message);
        }

        console.log(`[SSH] Security chain passed, forwarding to GitHub`);
        await forwardPackDataToRemote(command, stream, client, packData, capabilities.length);
      } catch (chainError: unknown) {
        console.error(
          `[SSH] Chain execution failed for user ${client.authenticatedUser?.username}:`,
          chainError,
        );
        const errorMessage = chainError instanceof Error ? chainError.message : String(chainError);
        stream.stderr.write(`Access denied: ${errorMessage}\n`);
        stream.exit(1);
        stream.end();
        return;
      }
    };

    const errorHandler = (error: Error) => {
      console.error(`[SSH] Stream error during push:`, error);
      stream.stderr.write(`Stream error: ${error.message}\n`);
      stream.exit(1);
      stream.end();
    };

    const pushTimeout = setTimeout(() => {
      console.error(`[SSH] Push operation timeout for user ${userName}`);
      stream.stderr.write('Error: Push operation timeout\n');
      stream.exit(1);
      stream.end();
    }, 300000); // 5 minutes

    // Clean up timeout when stream ends
    const timeoutAwareEndHandler = async () => {
      clearTimeout(pushTimeout);
      await endHandler();
    };

    const timeoutAwareErrorHandler = (error: Error) => {
      clearTimeout(pushTimeout);
      errorHandler(error);
    };

    // Attach event handlers to receive pack data from client
    stream.on('data', dataHandler);
    stream.once('end', timeoutAwareEndHandler);
    stream.on('error', timeoutAwareErrorHandler);
  }

  private async handlePullOperation(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
    repoPath: string,
    gitPath: string,
  ): Promise<void> {
    console.log(`[SSH] Handling pull operation for ${repoPath}`);

    // For pull operations, execute chain first (no pack data to capture)
    const req = this.createChainRequest(repoPath, gitPath, client, 'GET');
    const res = createMockResponse();

    // Execute the proxy chain
    try {
      const result = await chain.executeChain(req, res);
      if (result.error || result.blocked) {
        const message =
          result.errorMessage || result.blockedMessage || 'Request blocked by proxy chain';
        throw new Error(message);
      }

      // Chain passed, connect to remote Git server
      await connectToRemoteGitServer(command, stream, client);
    } catch (chainError: unknown) {
      console.error(
        `[SSH] Chain execution failed for user ${client.authenticatedUser?.username}:`,
        chainError,
      );
      const errorMessage = chainError instanceof Error ? chainError.message : String(chainError);
      stream.stderr.write(`Access denied: ${errorMessage}\n`);
      stream.exit(1);
      stream.end();
      return;
    }
  }

  public start(): void {
    const sshConfig = getSSHConfig();
    const port = sshConfig.port || 2222;

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`[SSH] Server listening on port ${port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('[SSH] Server stopped');
      });
    }
  }
}

export default SSHServer;
