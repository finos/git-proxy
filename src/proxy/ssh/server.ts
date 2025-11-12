import * as ssh2 from 'ssh2';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import { getSSHConfig, getProxyUrl, getMaxPackSizeBytes, getDomains } from '../../config';
import { serverConfig } from '../../config/env';
import chain from '../chain';
import * as db from '../../db';
import { Action } from '../actions';
import { SSHAgent } from '../../security/SSHAgent';
import { SSHKeyManager } from '../../security/SSHKeyManager';
import { KILOBYTE, MEGABYTE } from '../../constants';

interface SSHUser {
  username: string;
  password?: string | null;
  publicKeys?: string[];
  email?: string;
  gitAccount?: string;
}

interface AuthenticatedUser {
  username: string;
  email?: string;
  gitAccount?: string;
}

interface ClientWithUser extends ssh2.Connection {
  userPrivateKey?: {
    keyType: string;
    keyData: Buffer;
  };
  authenticatedUser?: AuthenticatedUser;
  clientIp?: string;
}

export class SSHServer {
  private server: ssh2.Server;
  private keepaliveTimers: Map<ssh2.Connection, NodeJS.Timeout> = new Map();

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
    const proxyPort = Number(serverConfig.GIT_PROXY_SERVER_PORT) || 8000;
    const domains = getDomains();
    const candidateHosts = [
      typeof domains?.service === 'string' ? domains.service : undefined,
      typeof serverConfig.GIT_PROXY_UI_HOST === 'string'
        ? serverConfig.GIT_PROXY_UI_HOST
        : undefined,
    ];

    for (const candidate of candidateHosts) {
      const host = this.extractHostname(candidate);
      if (host) {
        return `${host}:${proxyPort}`;
      }
    }

    return `localhost:${proxyPort}`;
  }

  private extractHostname(candidate?: string): string | null {
    if (!candidate) {
      return null;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }

    const attemptParse = (value: string): string | null => {
      try {
        const parsed = new URL(value);
        if (parsed.hostname) {
          return parsed.hostname;
        }
        if (parsed.host) {
          return parsed.host;
        }
      } catch {
        return null;
      }
      return null;
    };

    // Try parsing the raw string
    let host = attemptParse(trimmed);
    if (host) {
      return host;
    }

    // Try assuming https scheme if missing
    host = attemptParse(`https://${trimmed}`);
    if (host) {
      return host;
    }

    // Fallback: remove protocol-like prefixes and trailing paths
    const withoutScheme = trimmed.replace(/^[a-zA-Z]+:\/\//, '');
    const withoutPath = withoutScheme.split('/')[0];
    const hostnameOnly = withoutPath.split(':')[0];
    return hostnameOnly || null;
  }

  private buildAuthContext(client: ClientWithUser) {
    const sshConfig = getSSHConfig();
    const serviceToken =
      sshConfig?.clone?.serviceToken &&
      sshConfig.clone.serviceToken.username &&
      sshConfig.clone.serviceToken.password
        ? {
            username: sshConfig.clone.serviceToken.username,
            password: sshConfig.clone.serviceToken.password,
          }
        : undefined;

    return {
      protocol: 'ssh' as const,
      username: client.authenticatedUser?.username,
      email: client.authenticatedUser?.email,
      gitAccount: client.authenticatedUser?.gitAccount,
      sshKey: client.userPrivateKey,
      clientIp: client.clientIp,
      cloneServiceToken: serviceToken,
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

    // Set up connection timeout (10 minutes)
    const connectionTimeout = setTimeout(() => {
      console.log(`[SSH] Connection timeout for ${clientIp} - closing`);
      client.end();
    }, 600000); // 10 minute timeout

    // Set up client error handling
    client.on('error', (err: Error) => {
      console.error(`[SSH] Client error from ${clientIp}:`, err);
      clearTimeout(connectionTimeout);
      // Don't end the connection on error, let it try to recover
    });

    // Handle client end
    client.on('end', () => {
      console.log(`[SSH] Client disconnected from ${clientIp}`);
      clearTimeout(connectionTimeout);
      // Clean up keepalive timer
      const keepaliveTimer = this.keepaliveTimers.get(client);
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        this.keepaliveTimers.delete(client);
      }
    });

    // Handle client close
    client.on('close', () => {
      console.log(`[SSH] Client connection closed from ${clientIp}`);
      clearTimeout(connectionTimeout);
      // Clean up keepalive timer
      const keepaliveTimer = this.keepaliveTimers.get(client);
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        this.keepaliveTimers.delete(client);
      }
    });

    // Handle keepalive requests
    (client as any).on('global request', (accept: () => void, reject: () => void, info: any) => {
      console.log('[SSH] Global request:', info);
      if (info.type === 'keepalive@openssh.com') {
        console.log('[SSH] Accepting keepalive request');
        // Always accept keepalive requests to prevent connection drops
        accept();
      } else {
        console.log('[SSH] Rejecting unknown global request:', info.type);
        reject();
      }
    });

    // Handle authentication
    client.on('authentication', (ctx: ssh2.AuthContext) => {
      console.log(
        `[SSH] Authentication attempt from ${clientIp}:`,
        ctx.method,
        'for user:',
        ctx.username,
      );

      if (ctx.method === 'publickey') {
        // Handle public key authentication
        const keyString = `${ctx.key.algo} ${ctx.key.data.toString('base64')}`;

        (db as any)
          .findUserBySSHKey(keyString)
          .then((user: any) => {
            if (user) {
              console.log(
                `[SSH] Public key authentication successful for user: ${user.username} from ${clientIp}`,
              );
              // Store the public key info and user context for later use
              clientWithUser.userPrivateKey = {
                keyType: ctx.key.algo,
                keyData: ctx.key.data,
              };
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
        // Handle password authentication
        db.findUser(ctx.username)
          .then((user: SSHUser | null) => {
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
                    // Store user context for later use
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

    // Set up keepalive timer
    const startKeepalive = (): void => {
      // Clean up any existing timer
      const existingTimer = this.keepaliveTimers.get(client);
      if (existingTimer) {
        clearInterval(existingTimer);
      }

      const keepaliveTimer = setInterval(() => {
        if ((client as any).connected !== false) {
          console.log(`[SSH] Sending keepalive to ${clientIp}`);
          try {
            (client as any).ping();
          } catch (error) {
            console.error(`[SSH] Error sending keepalive to ${clientIp}:`, error);
            // Don't clear the timer on error, let it try again
          }
        } else {
          console.log(`[SSH] Client ${clientIp} disconnected, clearing keepalive`);
          clearInterval(keepaliveTimer);
          this.keepaliveTimers.delete(client);
        }
      }, 15000); // 15 seconds between keepalives (recommended for SSH connections is 15-30 seconds)

      this.keepaliveTimers.set(client, keepaliveTimer);
    };

    // Handle ready state
    client.on('ready', () => {
      console.log(
        `[SSH] Client ready from ${clientIp}, user: ${clientWithUser.authenticatedUser?.username || 'unknown'}, starting keepalive`,
      );
      clearTimeout(connectionTimeout);
      startKeepalive();
    });

    // Handle session requests
    client.on('session', (accept: () => ssh2.ServerChannel, reject: () => void) => {
      console.log('[SSH] Session requested');
      const session = accept();

      // Handle command execution
      session.on(
        'exec',
        (accept: () => ssh2.ServerChannel, reject: () => void, info: { command: string }) => {
          console.log('[SSH] Command execution requested:', info.command);
          const stream = accept();

          this.handleCommand(info.command, stream, clientWithUser);
        },
      );
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

    // Validate user is authenticated
    if (!client.authenticatedUser) {
      console.error(`[SSH] Unauthenticated command attempt from ${clientIp}`);
      stream.stderr.write('Authentication required\n');
      stream.exit(1);
      stream.end();
      return;
    }

    try {
      // Check if it's a Git command
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

      const repoPath = repoMatch[1];
      const isReceivePack = command.includes('git-receive-pack');
      const gitPath = isReceivePack ? 'git-receive-pack' : 'git-upload-pack';

      console.log(
        `[SSH] Git command for repository: ${repoPath} from user: ${client.authenticatedUser?.username || 'unknown'}`,
      );

      if (isReceivePack) {
        // For push operations (git-receive-pack), we need to capture pack data first
        await this.handlePushOperation(command, stream, client, repoPath, gitPath);
      } else {
        // For pull operations (git-upload-pack), execute chain first then stream
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
    console.log(`[SSH] Handling push operation for ${repoPath}`);

    // Create pack data capture buffers
    const packDataChunks: Buffer[] = [];
    let totalBytes = 0;
    const maxPackSize = getMaxPackSizeBytes();
    const maxPackSizeDisplay = this.formatBytes(maxPackSize);
    const hostHeader = this.resolveHostHeader();

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
        console.log(`[SSH] Captured ${data.length} bytes, total: ${totalBytes} bytes`);
      } catch (error) {
        console.error(`[SSH] Error processing data chunk:`, error);
        stream.stderr.write(`Error: Failed to process data chunk: ${error}\n`);
        stream.exit(1);
        stream.end();
      }
    };

    const endHandler = async () => {
      console.log(`[SSH] Pack data capture complete: ${totalBytes} bytes`);

      try {
        // Validate pack data before processing
        if (packDataChunks.length === 0 && totalBytes === 0) {
          console.warn(`[SSH] No pack data received for push operation`);
          // Allow empty pushes (e.g., tag creation without commits)
        }

        // Concatenate all pack data chunks with error handling
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

        // Create request object with captured pack data
        const req = {
          originalUrl: `/${repoPath}/${gitPath}`,
          url: `/${repoPath}/${gitPath}`,
          method: 'POST' as const,
          headers: {
            'user-agent': 'git/ssh-proxy',
            'content-type': 'application/x-git-receive-pack-request',
            host: hostHeader,
            'content-length': totalBytes.toString(),
            'x-forwarded-proto': 'https',
            'x-forwarded-host': hostHeader,
          },
          body: packData,
          bodyRaw: packData,
          user: client.authenticatedUser || null,
          isSSH: true,
          protocol: 'ssh' as const,
          sshUser: {
            username: client.authenticatedUser?.username || 'unknown',
            email: client.authenticatedUser?.email,
            gitAccount: client.authenticatedUser?.gitAccount,
            sshKeyInfo: client.userPrivateKey,
          },
          authContext: this.buildAuthContext(client),
        };

        // Create mock response object
        const res = {
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
          send: function (data: any) {
            return this;
          },
        };

        // Execute the proxy chain with captured pack data
        console.log(`[SSH] Executing security chain for push operation`);
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

        console.log(`[SSH] Security chain passed, forwarding to remote`);
        // Chain passed, now forward the captured data to remote
        try {
          await this.forwardPackDataToRemote(command, stream, client, packData, chainResult);
        } catch (forwardError) {
          console.error(`[SSH] Error forwarding pack data to remote:`, forwardError);
          stream.stderr.write(`Error forwarding to remote: ${forwardError}\n`);
          stream.exit(1);
          stream.end();
          return;
        }
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
      console.error(`[SSH] Stream error during pack capture:`, error);
      stream.stderr.write(`Stream error: ${error.message}\n`);
      stream.exit(1);
      stream.end();
    };

    // Set up timeout for pack data capture (5 minutes max)
    const captureTimeout = setTimeout(() => {
      console.error(
        `[SSH] Pack data capture timeout for user ${client.authenticatedUser?.username}`,
      );
      stream.stderr.write('Error: Pack data capture timeout\n');
      stream.exit(1);
      stream.end();
    }, 300000); // 5 minutes

    // Clean up timeout when stream ends
    const originalEndHandler = endHandler;
    const timeoutAwareEndHandler = async () => {
      clearTimeout(captureTimeout);
      await originalEndHandler();
    };

    const timeoutAwareErrorHandler = (error: Error) => {
      clearTimeout(captureTimeout);
      errorHandler(error);
    };

    // Attach event handlers
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
    const hostHeader = this.resolveHostHeader();

    // For pull operations, execute chain first (no pack data to capture)
    const req = {
      originalUrl: `/${repoPath}/${gitPath}`,
      url: `/${repoPath}/${gitPath}`,
      method: 'GET' as const,
      headers: {
        'user-agent': 'git/ssh-proxy',
        'content-type': 'application/x-git-upload-pack-request',
        host: hostHeader,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': hostHeader,
      },
      body: null,
      user: client.authenticatedUser || null,
      isSSH: true,
      protocol: 'ssh' as const,
      sshUser: {
        username: client.authenticatedUser?.username || 'unknown',
        email: client.authenticatedUser?.email,
        gitAccount: client.authenticatedUser?.gitAccount,
        sshKeyInfo: client.userPrivateKey,
      },
      authContext: this.buildAuthContext(client),
    };

    const res = {
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
      send: function (data: any) {
        return this;
      },
    };

    // Execute the proxy chain
    try {
      console.log(`[SSH] Executing security chain for pull operation`);
      const result = await chain.executeChain(req, res);
      if (result.error || result.blocked) {
        const message =
          result.errorMessage || result.blockedMessage || 'Request blocked by proxy chain';
        throw new Error(message);
      }

      console.log(`[SSH] Security chain passed, connecting to remote`);
      // Chain passed, connect to remote Git server
      await this.connectToRemoteGitServer(command, stream, client);
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

  private async forwardPackDataToRemote(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
    packData: Buffer | null,
    action?: Action,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const userName = client.authenticatedUser?.username || 'unknown';
      console.log(`[SSH] Forwarding pack data to remote for user: ${userName}`);

      // Get remote host from config
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        const error = new Error('No proxy URL configured');
        console.error(`[SSH] ${error.message}`);
        stream.stderr.write(`Configuration error: ${error.message}\n`);
        stream.exit(1);
        stream.end();
        reject(error);
        return;
      }

      const remoteUrl = new URL(proxyUrl);
      const sshConfig = getSSHConfig();

      const sshAgentInstance = SSHAgent.getInstance();
      let agentKeyCopy: Buffer | null = null;
      let decryptedKey: Buffer | null = null;

      if (action?.id) {
        const agentKey = sshAgentInstance.getPrivateKey(action.id);
        if (agentKey) {
          agentKeyCopy = Buffer.from(agentKey);
        }
      }

      if (!agentKeyCopy && action?.encryptedSSHKey && action?.sshKeyExpiry) {
        const expiry = new Date(action.sshKeyExpiry);
        if (!Number.isNaN(expiry.getTime())) {
          const decrypted = SSHKeyManager.decryptSSHKey(action.encryptedSSHKey, expiry);
          if (decrypted) {
            decryptedKey = decrypted;
          }
        }
      }

      const userPrivateKey = agentKeyCopy ?? decryptedKey;
      const usingUserKey = Boolean(userPrivateKey);
      const proxyPrivateKey = fs.readFileSync(sshConfig.hostKey.privateKeyPath);

      if (usingUserKey) {
        console.log(
          `[SSH] Using caller SSH key for push ${action?.id ?? 'unknown'} when forwarding to remote`,
        );
      } else {
        console.log(
          '[SSH] Falling back to proxy SSH key when forwarding to remote (no caller key available)',
        );
      }

      let cleanupRan = false;
      const cleanupForwardingKey = () => {
        if (cleanupRan) {
          return;
        }
        cleanupRan = true;
        if (usingUserKey && action?.id) {
          sshAgentInstance.removeKey(action.id);
        }
        if (agentKeyCopy) {
          agentKeyCopy.fill(0);
        }
        if (decryptedKey) {
          decryptedKey.fill(0);
        }
      };

      // Set up connection options (same as original connectToRemoteGitServer)
      const connectionOptions: any = {
        host: remoteUrl.hostname,
        port: 22,
        username: 'git',
        tryKeyboard: false,
        readyTimeout: 30000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 5,
        windowSize: 1 * MEGABYTE,
        packetSize: 32 * KILOBYTE,
        privateKey: usingUserKey ? (userPrivateKey as Buffer) : proxyPrivateKey,
        debug: (msg: string) => {
          console.debug('[GitHub SSH Debug]', msg);
        },
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
          cipher: [
            'aes128-gcm' as any,
            'aes256-gcm' as any,
            'aes128-ctr' as any,
            'aes256-ctr' as any,
          ],
          hmac: ['hmac-sha2-256' as any, 'hmac-sha2-512' as any],
        },
      };

      const remoteGitSsh = new ssh2.Client();

      // Handle connection success
      remoteGitSsh.on('ready', () => {
        console.log(`[SSH] Connected to remote Git server for user: ${userName}`);

        // Execute the Git command on the remote server
        remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
          if (err) {
            console.error(`[SSH] Error executing command on remote for user ${userName}:`, err);
            stream.stderr.write(`Remote execution error: ${err.message}\n`);
            stream.exit(1);
            stream.end();
            remoteGitSsh.end();
            cleanupForwardingKey();
            reject(err);
            return;
          }

          console.log(
            `[SSH] Command executed on remote for user ${userName}, forwarding pack data`,
          );

          // Forward the captured pack data to remote
          if (packData && packData.length > 0) {
            console.log(`[SSH] Writing ${packData.length} bytes of pack data to remote`);
            remoteStream.write(packData);
          }

          // End the write stream to signal completion
          remoteStream.end();

          // Handle remote response
          remoteStream.on('data', (data: any) => {
            stream.write(data);
          });

          remoteStream.on('close', () => {
            console.log(`[SSH] Remote stream closed for user: ${userName}`);
            cleanupForwardingKey();
            stream.end();
            resolve();
          });

          remoteStream.on('exit', (code: number, signal?: string) => {
            console.log(
              `[SSH] Remote command exited for user ${userName} with code: ${code}, signal: ${signal || 'none'}`,
            );
            stream.exit(code || 0);
            cleanupForwardingKey();
            resolve();
          });

          remoteStream.on('error', (err: Error) => {
            console.error(`[SSH] Remote stream error for user ${userName}:`, err);
            stream.stderr.write(`Stream error: ${err.message}\n`);
            stream.exit(1);
            stream.end();
            cleanupForwardingKey();
            reject(err);
          });
        });
      });

      // Handle connection errors
      remoteGitSsh.on('error', (err: Error) => {
        console.error(`[SSH] Remote connection error for user ${userName}:`, err);
        stream.stderr.write(`Connection error: ${err.message}\n`);
        stream.exit(1);
        stream.end();
        cleanupForwardingKey();
        reject(err);
      });

      // Set connection timeout
      const connectTimeout = setTimeout(() => {
        console.error(`[SSH] Connection timeout to remote for user ${userName}`);
        remoteGitSsh.end();
        stream.stderr.write('Connection timeout to remote server\n');
        stream.exit(1);
        stream.end();
        cleanupForwardingKey();
        reject(new Error('Connection timeout'));
      }, 30000);

      remoteGitSsh.on('ready', () => {
        clearTimeout(connectTimeout);
      });

      // Connect to remote
      console.log(`[SSH] Connecting to ${remoteUrl.hostname} for user ${userName}`);
      remoteGitSsh.connect(connectionOptions);
    });
  }

  private async connectToRemoteGitServer(
    command: string,
    stream: ssh2.ServerChannel,
    client: ClientWithUser,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const userName = client.authenticatedUser?.username || 'unknown';
      console.log(`[SSH] Creating SSH connection to remote for user: ${userName}`);

      // Get remote host from config
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        const error = new Error('No proxy URL configured');
        console.error(`[SSH] ${error.message}`);
        stream.stderr.write(`Configuration error: ${error.message}\n`);
        stream.exit(1);
        stream.end();
        reject(error);
        return;
      }

      const remoteUrl = new URL(proxyUrl);
      const sshConfig = getSSHConfig();

      // TODO: Connection options could go to config
      // Set up connection options
      const connectionOptions: any = {
        host: remoteUrl.hostname,
        port: 22,
        username: 'git',
        tryKeyboard: false,
        readyTimeout: 30000,
        keepaliveInterval: 15000, // 15 seconds between keepalives (recommended for SSH connections is 15-30 seconds)
        keepaliveCountMax: 5, // Recommended for SSH connections is 3-5 attempts
        windowSize: 1 * MEGABYTE, // 1MB window size
        packetSize: 32 * KILOBYTE, // 32KB packet size
        privateKey: fs.readFileSync(sshConfig.hostKey.privateKeyPath),
        debug: (msg: string) => {
          console.debug('[GitHub SSH Debug]', msg);
        },
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
          cipher: [
            'aes128-gcm' as any,
            'aes256-gcm' as any,
            'aes128-ctr' as any,
            'aes256-ctr' as any,
          ],
          hmac: ['hmac-sha2-256' as any, 'hmac-sha2-512' as any],
        },
      };

      // Get the client's SSH key that was used for authentication
      const clientKey = client.userPrivateKey;
      console.log('[SSH] Client key:', clientKey ? 'Available' : 'Not available');

      // Handle client key if available (though we only have public key data)
      if (clientKey) {
        console.log('[SSH] Using client key info:', JSON.stringify(clientKey));
        // Check if the key is in the correct format
        if (typeof clientKey === 'object' && clientKey.keyType && clientKey.keyData) {
          // We need to use the private key, not the public key data
          // Since we only have the public key from authentication, we'll use the proxy key
          console.log('[SSH] Only have public key data, using proxy key instead');
        } else if (Buffer.isBuffer(clientKey)) {
          // The key is a buffer, use it directly
          connectionOptions.privateKey = clientKey;
          console.log('[SSH] Using client key buffer directly');
        } else {
          // For other key types, we can't use the client key directly since we only have public key info
          console.log('[SSH] Client key is not a buffer, falling back to proxy key');
        }
      } else {
        console.log('[SSH] No client key available, using proxy key');
      }

      // Log the key type for debugging
      if (connectionOptions.privateKey) {
        if (
          typeof connectionOptions.privateKey === 'object' &&
          (connectionOptions.privateKey as any).algo
        ) {
          console.log(`[SSH] Key algo: ${(connectionOptions.privateKey as any).algo}`);
        } else if (Buffer.isBuffer(connectionOptions.privateKey)) {
          console.log(`[SSH] Key is a buffer of length: ${connectionOptions.privateKey.length}`);
        } else {
          console.log(`[SSH] Key is of type: ${typeof connectionOptions.privateKey}`);
        }
      }

      const remoteGitSsh = new ssh2.Client();

      // Handle connection success
      remoteGitSsh.on('ready', () => {
        console.log(`[SSH] Connected to remote Git server for user: ${userName}`);

        // Execute the Git command on the remote server
        remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
          if (err) {
            console.error(`[SSH] Error executing command on remote for user ${userName}:`, err);
            stream.stderr.write(`Remote execution error: ${err.message}\n`);
            stream.exit(1);
            stream.end();
            remoteGitSsh.end();
            reject(err);
            return;
          }

          console.log(
            `[SSH] Command executed on remote for user ${userName}, setting up data piping`,
          );

          // Handle stream errors
          remoteStream.on('error', (err: Error) => {
            console.error(`[SSH] Remote stream error for user ${userName}:`, err);
            // Don't immediately end the stream on error, try to recover
            if (
              err.message.includes('early EOF') ||
              err.message.includes('unexpected disconnect')
            ) {
              console.log(
                `[SSH] Detected early EOF or unexpected disconnect for user ${userName}, attempting to recover`,
              );
              // Try to keep the connection alive
              if ((remoteGitSsh as any).connected) {
                console.log(`[SSH] Connection still active for user ${userName}, continuing`);
                // Don't end the stream, let it try to recover
                return;
              }
            }
            // If we can't recover, then end the stream
            stream.stderr.write(`Stream error: ${err.message}\n`);
            stream.end();
          });

          // Pipe data between client and remote
          stream.on('data', (data: any) => {
            remoteStream.write(data);
          });

          remoteStream.on('data', (data: any) => {
            stream.write(data);
          });

          // Handle stream events
          remoteStream.on('close', () => {
            console.log(`[SSH] Remote stream closed for user: ${userName}`);
            stream.end();
            resolve();
          });

          remoteStream.on('exit', (code: number, signal?: string) => {
            console.log(
              `[SSH] Remote command exited for user ${userName} with code: ${code}, signal: ${signal || 'none'}`,
            );
            stream.exit(code || 0);
            resolve();
          });

          stream.on('close', () => {
            console.log(`[SSH] Client stream closed for user: ${userName}`);
            remoteStream.end();
          });

          stream.on('end', () => {
            console.log(`[SSH] Client stream ended for user: ${userName}`);
            setTimeout(() => {
              remoteGitSsh.end();
            }, 1000);
          });

          // Handle errors on streams
          remoteStream.on('error', (err: Error) => {
            console.error(`[SSH] Remote stream error for user ${userName}:`, err);
            stream.stderr.write(`Stream error: ${err.message}\n`);
          });

          stream.on('error', (err: Error) => {
            console.error(`[SSH] Client stream error for user ${userName}:`, err);
            remoteStream.destroy();
          });
        });
      });

      // Handle connection errors
      remoteGitSsh.on('error', (err: Error) => {
        console.error(`[SSH] Remote connection error for user ${userName}:`, err);

        if (err.message.includes('All configured authentication methods failed')) {
          console.log(
            `[SSH] Authentication failed with default key for user ${userName}, this may be expected for some servers`,
          );
        }

        stream.stderr.write(`Connection error: ${err.message}\n`);
        stream.exit(1);
        stream.end();
        reject(err);
      });

      // Handle connection close
      remoteGitSsh.on('close', () => {
        console.log(`[SSH] Remote connection closed for user: ${userName}`);
      });

      // Set a timeout for the connection attempt
      const connectTimeout = setTimeout(() => {
        console.error(`[SSH] Connection timeout to remote for user ${userName}`);
        remoteGitSsh.end();
        stream.stderr.write('Connection timeout to remote server\n');
        stream.exit(1);
        stream.end();
        reject(new Error('Connection timeout'));
      }, 30000);

      remoteGitSsh.on('ready', () => {
        clearTimeout(connectTimeout);
      });

      // Connect to remote
      console.log(`[SSH] Connecting to ${remoteUrl.hostname} for user ${userName}`);
      remoteGitSsh.connect(connectionOptions);
    });
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
