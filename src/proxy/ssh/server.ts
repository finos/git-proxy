import * as ssh2 from 'ssh2';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import { getSSHConfig, getProxyUrl } from '../../config';
import chain from '../chain';
import * as db from '../../db';

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

  constructor() {
    const sshConfig = getSSHConfig();
    this.server = new ssh2.Server(
      {
        hostKeys: [fs.readFileSync(sshConfig.hostKey.privateKeyPath)],
        // Increase connection timeout and keepalive settings
        keepaliveInterval: 5000, // More frequent keepalive
        keepaliveCountMax: 10, // Allow more keepalive attempts
        readyTimeout: 30000, // Longer ready timeout
        debug: (msg: string) => {
          if (process.env.SSH_DEBUG === 'true') {
            console.debug('[SSH Debug]', msg);
          }
        },
      } as any, // Cast to any to avoid strict type checking for now
      (client: ssh2.Connection, info: any) => {
        // Pass client connection info to the handler
        this.handleClient(client, { ip: info?.ip, family: info?.family });
      },
    );
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
      // Close connection on error for security
      client.end();
    });

    // Handle client end
    client.on('end', () => {
      console.log(`[SSH] Client disconnected from ${clientIp}`);
      clearTimeout(connectionTimeout);
    });

    // Handle client close
    client.on('close', () => {
      console.log(`[SSH] Client connection closed from ${clientIp}`);
      clearTimeout(connectionTimeout);
    });

    // Handle keepalive requests
    (client as any).on('global request', (accept: () => void, reject: () => void, info: any) => {
      console.log('[SSH] Global request:', info);
      if (info.type === 'keepalive@openssh.com') {
        console.log('[SSH] Accepting keepalive request');
        // Always accept keepalive requests to prevent connection drops
        accept();
      } else {
        console.log('[SSH] Rejecting global request:', info.type);
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

    // Set up keepalive functionality
    const startKeepalive = (): void => {
      const keepaliveInterval = setInterval(() => {
        try {
          // Use a type assertion to access ping method
          (client as any).ping();
          console.log('[SSH] Sent keepalive ping to client');
        } catch (err) {
          console.error('[SSH] Failed to send keepalive ping:', err);
          clearInterval(keepaliveInterval);
        }
      }, 30000); // Send ping every 30 seconds

      client.on('close', () => {
        clearInterval(keepaliveInterval);
      });
    };

    // Handle ready state
    client.on('ready', () => {
      console.log(
        `[SSH] Client ready from ${clientIp}, user: ${clientWithUser.authenticatedUser?.username || 'unknown'}`,
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

  private async handleCommand(
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

      // Create a properly formatted HTTP request for the proxy chain
      // Match the format expected by the HTTPS flow
      const req = {
        originalUrl: `/${repoPath}/${gitPath}`,
        url: `/${repoPath}/${gitPath}`,
        method: isReceivePack ? 'POST' : 'GET',
        headers: {
          'user-agent': 'git/ssh-proxy',
          'content-type': isReceivePack
            ? 'application/x-git-receive-pack-request'
            : 'application/x-git-upload-pack-request',
          host: 'ssh-proxy',
        },
        body: null,
        user: client.authenticatedUser || null,
        isSSH: true,
      };

      // Create a mock response object for the chain
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
        const result = await chain.executeChain(req, res);
        if (result.error || result.blocked) {
          const message =
            result.errorMessage || result.blockedMessage || 'Request blocked by proxy chain';
          throw new Error(message);
        }
      } catch (chainError) {
        console.error(
          `[SSH] Chain execution failed for user ${client.authenticatedUser?.username}:`,
          chainError,
        );
        stream.stderr.write(`Access denied: ${chainError}\n`);
        stream.exit(1);
        stream.end();
        return;
      }

      // If chain passed, connect to remote Git server
      await this.connectToRemoteGitServer(command, stream, client);
    } catch (error) {
      console.error('[SSH] Error in Git command handling:', error);
      stream.stderr.write(`Error: ${error}\n`);
      stream.exit(1);
      stream.end();
    }
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

      // Set up connection options
      const connectionOptions = {
        host: remoteUrl.hostname,
        port: 22,
        username: 'git',
        tryKeyboard: false,
        readyTimeout: 30000,
        keepaliveInterval: 5000,
        keepaliveCountMax: 10,
        privateKey: fs.readFileSync(sshConfig.hostKey.privateKeyPath),
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
            reject(err);
            return;
          }

          console.log(
            `[SSH] Command executed on remote for user ${userName}, setting up data piping`,
          );

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
