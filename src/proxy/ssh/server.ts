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
}

interface ClientWithUser extends ssh2.Connection {
  userPrivateKey?: {
    keyType: string;
    keyData: Buffer;
  };
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
          console.debug('[SSH Debug]', msg);
        },
      } as any, // Cast to any to avoid strict type checking for now
      this.handleClient.bind(this),
    );
  }

  async handleClient(client: ssh2.Connection): Promise<void> {
    console.log('[SSH] Client connected');
    const clientWithUser = client as ClientWithUser;

    // Set up client error handling
    client.on('error', (err: Error) => {
      console.error('[SSH] Client error:', err);
      // Don't end the connection on error, let it try to recover
    });

    // Handle client end
    client.on('end', () => {
      console.log('[SSH] Client disconnected');
    });

    // Handle client close
    client.on('close', () => {
      console.log('[SSH] Client connection closed');
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
      console.log('[SSH] Authentication attempt:', ctx.method, 'for user:', ctx.username);

      if (ctx.method === 'publickey') {
        // Handle public key authentication
        const keyString = `${ctx.key.algo} ${ctx.key.data.toString('base64')}`;

        (db as any)
          .findUserBySSHKey(keyString)
          .then((user: any) => {
            if (user) {
              console.log(`[SSH] Public key authentication successful for user: ${user.username}`);
              // Store the public key info for later use
              clientWithUser.userPrivateKey = {
                keyType: ctx.key.algo,
                keyData: ctx.key.data,
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
                      `[SSH] Password authentication successful for user: ${user.username}`,
                    );
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
      console.log('[SSH] Client ready, starting keepalive');
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
    console.log('[SSH] Handling command:', command);

    try {
      // Check if it's a Git command
      if (command.startsWith('git-')) {
        await this.handleGitCommand(command, stream, client);
      } else {
        console.log('[SSH] Unsupported command:', command);
        stream.stderr.write(`Unsupported command: ${command}\n`);
        stream.exit(1);
        stream.end();
      }
    } catch (error) {
      console.error('[SSH] Error handling command:', error);
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
      console.log('[SSH] Git command for repository:', repoPath);

      // Create a simulated HTTP request for the proxy chain
      const req = {
        url: repoPath,
        method: command.startsWith('git-upload-pack') ? 'GET' : 'POST',
        headers: {
          'user-agent': 'git/ssh-proxy',
          'content-type': command.startsWith('git-receive-pack')
            ? 'application/x-git-receive-pack-request'
            : 'application/x-git-upload-pack-request',
        },
        body: null,
        user: client.userPrivateKey ? { username: 'ssh-user' } : null,
      };

      // Execute the proxy chain
      try {
        const result = await chain.executeChain(req, {} as any);
        if (result.error || result.blocked) {
          throw new Error(result.message || 'Request blocked by proxy chain');
        }
      } catch (chainError) {
        console.error('[SSH] Chain execution failed:', chainError);
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
      console.log('[SSH] Creating SSH connection to remote');

      // Get remote host from config
      const proxyUrl = getProxyUrl();
      if (!proxyUrl) {
        reject(new Error('No proxy URL configured'));
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
        console.log('[SSH] Connected to remote Git server');

        // Execute the Git command on the remote server
        remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
          if (err) {
            console.error('[SSH] Error executing command on remote:', err);
            stream.stderr.write(`Remote execution error: ${err.message}\n`);
            stream.exit(1);
            stream.end();
            remoteGitSsh.end();
            reject(err);
            return;
          }

          console.log('[SSH] Command executed on remote, setting up data piping');

          // Pipe data between client and remote
          stream.on('data', (data: Buffer) => {
            remoteStream.write(data);
          });

          remoteStream.on('data', (data: Buffer) => {
            stream.write(data);
          });

          // Handle stream events
          remoteStream.on('close', () => {
            console.log('[SSH] Remote stream closed');
            stream.end();
            resolve();
          });

          remoteStream.on('exit', (code: number, signal?: string) => {
            console.log('[SSH] Remote command exited with code:', code, 'signal:', signal);
            stream.exit(code || 0);
            resolve();
          });

          stream.on('close', () => {
            console.log('[SSH] Client stream closed');
            remoteStream.end();
          });

          stream.on('end', () => {
            console.log('[SSH] Client stream ended');
            setTimeout(() => {
              remoteGitSsh.end();
            }, 1000);
          });
        });
      });

      // Handle connection errors with retry logic
      remoteGitSsh.on('error', (err: Error) => {
        console.error('[SSH] Remote connection error:', err);

        if (err.message.includes('All configured authentication methods failed')) {
          console.log(
            '[SSH] Authentication failed with default key, this is expected for some servers',
          );
        }

        stream.stderr.write(`Connection error: ${err.message}\n`);
        stream.exit(1);
        stream.end();
        reject(err);
      });

      // Handle connection close
      remoteGitSsh.on('close', () => {
        console.log('[SSH] Remote connection closed');
      });

      // Connect to remote
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
