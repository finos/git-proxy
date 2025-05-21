const ssh2 = require('ssh2');
const config = require('../../config');
const chain = require('../chain');
const db = require('../../db');

class SSHServer {
  constructor() {
    // TODO: Server config could go to config file
    this.server = new ssh2.Server(
      {
        hostKeys: [require('fs').readFileSync(config.getSSHConfig().hostKey.privateKeyPath)],
        authMethods: ['publickey', 'password'],
        keepaliveInterval: 20000, // 20 seconds is recommended for SSH connections
        keepaliveCountMax: 5, // Allow more keepalive attempts
        readyTimeout: 30000, // Longer ready timeout
        debug: (msg) => {
          console.debug('[SSH Debug]', msg);
        },
      },
      this.handleClient.bind(this),
    );
  }

  async handleClient(client) {
    console.log('[SSH] Client connected');

    // Set up client error handling
    client.on('error', (err) => {
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
    client.on('global request', (accept, reject, info) => {
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

    // Set up keepalive timer
    let keepaliveTimer = null;
    const startKeepalive = () => {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
      }
      keepaliveTimer = setInterval(() => {
        if (client.connected) {
          console.log('[SSH] Sending keepalive');
          try {
            client.ping();
          } catch (error) {
            console.error('[SSH] Error sending keepalive:', error);
            // Don't clear the timer on error, let it try again
          }
        } else {
          console.log('[SSH] Client disconnected, clearing keepalive');
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }
      }, 15000); // 15 seconds between keepalives (recommended for SSH connections is 15-30 seconds)
    };

    // Start keepalive when client is ready
    client.on('ready', () => {
      console.log('[SSH] Client ready, starting keepalive');
      startKeepalive();
    });

    // Clean up keepalive on client end
    client.on('end', () => {
      console.log('[SSH] Client disconnected');
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
    });

    client.on('authentication', async (ctx) => {
      console.log(`[SSH] Authentication attempt: ${ctx.method}`);

      if (ctx.method === 'publickey') {
        try {
          console.log(`[SSH] CTX KEY: ${JSON.stringify(ctx.key)}`);
          // Get the key type and key data
          const keyType = ctx.key.algo;
          const keyData = ctx.key.data;

          // Format the key in the same way as stored in user's publicKeys (without comment)
          const keyString = `${keyType} ${keyData.toString('base64')}`;

          console.log(`[SSH] Attempting public key authentication with key: ${keyString}`);

          // Find user by SSH key
          const user = await db.findUserBySSHKey(keyString);
          if (!user) {
            console.log('[SSH] No user found with this SSH key');
            ctx.reject();
            return;
          }

          console.log(`[SSH] Public key authentication successful for user ${user.username}`);
          client.username = user.username;
          // Store the user's private key for later use with GitHub
          client.userPrivateKey = {
            algo: ctx.key.algo,
            data: ctx.key.data,
            comment: ctx.key.comment || '',
          };
          console.log(
            `[SSH] Stored key info - Algorithm: ${ctx.key.algo}, Data length: ${ctx.key.data.length}, Data type: ${typeof ctx.key.data}`,
          );
          if (Buffer.isBuffer(ctx.key.data)) {
            console.log('[SSH] Key data is a Buffer');
          }
          ctx.accept();
        } catch (error) {
          console.error('[SSH] Error during public key authentication:', error);
          // Let the client try the next key
          ctx.reject();
        }
      } else if (ctx.method === 'password') {
        // Only try password authentication if no public key was provided
        if (!ctx.key) {
          try {
            const user = await db.findUser(ctx.username);
            if (user && user.password) {
              const bcrypt = require('bcryptjs');
              const isValid = await bcrypt.compare(ctx.password, user.password);
              if (isValid) {
                console.log(`[SSH] Password authentication successful for user ${ctx.username}`);
                ctx.accept();
              } else {
                console.log(`[SSH] Password authentication failed for user ${ctx.username}`);
                ctx.reject();
              }
            } else {
              console.log(`[SSH] User ${ctx.username} not found or no password set`);
              ctx.reject();
            }
          } catch (error) {
            console.error('[SSH] Error during password authentication:', error);
            ctx.reject();
          }
        } else {
          console.log('[SSH] Password authentication attempted but public key was provided');
          ctx.reject();
        }
      } else {
        console.log(`Unsupported authentication method: ${ctx.method}`);
        ctx.reject();
      }
    });

    client.on('ready', () => {
      console.log(`[SSH] Client ready: ${client.username}`);
      client.on('session', this.handleSession.bind(this));
    });
  }

  async handleSession(accept, reject) {
    const session = accept();
    session.on('exec', async (accept, reject, info) => {
      const stream = accept();
      const command = info.command;

      // Parse Git command
      console.log('[SSH] Command', command);
      if (command.startsWith('git-')) {
        // Extract the repository path from the command
        // Remove quotes and 'git-' prefix, then trim any leading/trailing slashes
        const repoPath = command
          .replace('git-upload-pack', '')
          .replace('git-receive-pack', '')
          .replace(/^['"]|['"]$/g, '')
          .replace(/^\/+|\/+$/g, '');

        const req = {
          method: command.startsWith('git-upload-pack') ? 'GET' : 'POST',
          originalUrl: repoPath,
          isSSH: true,
          headers: {
            'user-agent': 'git/2.0.0',
            'content-type': command.startsWith('git-receive-pack')
              ? 'application/x-git-receive-pack-request'
              : undefined,
          },
        };

        try {
          console.log('[SSH] Executing chain', req);
          const action = await chain.executeChain(req);

          console.log('[SSH] Action', action);

          if (action.error || action.blocked) {
            // If there's an error or the action is blocked, send the error message
            console.log(
              '[SSH] Action error or blocked',
              action.errorMessage || action.blockedMessage,
            );
            stream.write(action.errorMessage || action.blockedMessage);
            stream.end();
            return;
          }

          // Create SSH connection to GitHub using the Client approach
          const { Client } = require('ssh2');
          const remoteGitSsh = new Client();

          console.log('[SSH] Creating SSH connection to remote');

          // Get remote host from config
          const remoteUrl = new URL(config.getProxyUrl());

          // TODO: Connection options could go to config
          // Set up connection options
          const connectionOptions = {
            host: remoteUrl.hostname,
            port: 22,
            username: 'git',
            readyTimeout: 30000,
            tryKeyboard: false,
            debug: (msg) => {
              console.debug('[GitHub SSH Debug]', msg);
            },
            keepaliveInterval: 15000, // 15 seconds between keepalives (recommended for SSH connections is 15-30 seconds)
            keepaliveCountMax: 5, // Recommended for SSH connections is 3-5 attempts
            windowSize: 1024 * 1024, // 1MB window size
            packetSize: 32768, // 32KB packet size
          };

          // Get the client's SSH key that was used for authentication
          const clientKey = session._channel._client.userPrivateKey;
          console.log('[SSH] Client key:', clientKey ? 'Available' : 'Not available');

          // Add the private key based on what's available
          if (clientKey) {
            console.log('[SSH] Using client key to connect to remote' + JSON.stringify(clientKey));
            // Check if the key is in the correct format
            if (typeof clientKey === 'object' && clientKey.algo && clientKey.data) {
              // We need to use the private key, not the public key data
              // Since we only have the public key from authentication, we'll use the proxy key
              console.log('[SSH] Only have public key data, using proxy key instead');
              connectionOptions.privateKey = require('fs').readFileSync(
                config.getSSHConfig().hostKey.privateKeyPath,
              );
            } else if (Buffer.isBuffer(clientKey)) {
              // The key is a buffer, use it directly
              connectionOptions.privateKey = clientKey;
              console.log('[SSH] Using client key buffer directly');
            } else {
              // Try to convert the key to a buffer if it's a string
              try {
                connectionOptions.privateKey = Buffer.from(clientKey);
                console.log('[SSH] Converted client key to buffer');
              } catch (error) {
                console.error('[SSH] Failed to convert client key to buffer:', error);
                // Fall back to the proxy key
                connectionOptions.privateKey = require('fs').readFileSync(
                  config.getSSHConfig().hostKey.privateKeyPath,
                );
                console.log('[SSH] Falling back to proxy key');
              }
            }
          } else {
            console.log('[SSH] No client key available, using proxy key');
            connectionOptions.privateKey = require('fs').readFileSync(
              config.getSSHConfig().hostKey.privateKeyPath,
            );
          }

          // Log the key type for debugging
          if (connectionOptions.privateKey) {
            if (
              typeof connectionOptions.privateKey === 'object' &&
              connectionOptions.privateKey.algo
            ) {
              console.log(`[SSH] Key algo: ${connectionOptions.privateKey.algo}`);
            } else if (Buffer.isBuffer(connectionOptions.privateKey)) {
              console.log(
                `[SSH] Key is a buffer of length: ${connectionOptions.privateKey.length}`,
              );
            } else {
              console.log(`[SSH] Key is of type: ${typeof connectionOptions.privateKey}`);
            }
          }

          // Set up event handlers
          remoteGitSsh.on('ready', () => {
            console.log('[SSH] Connected to remote');

            // Execute the Git command on remote
            remoteGitSsh.exec(
              command,
              {
                env: {
                  GIT_PROTOCOL: 'version=2',
                  GIT_TERMINAL_PROMPT: '0',
                },
              },
              (err, remoteStream) => {
                if (err) {
                  console.error('[SSH] Failed to execute command on remote:', err);
                  stream.write(err.toString());
                  stream.end();
                  return;
                }

                // Handle stream errors
                remoteStream.on('error', (err) => {
                  console.error('[SSH] Remote stream error:', err);
                  // Don't immediately end the stream on error, try to recover
                  if (
                    err.message.includes('early EOF') ||
                    err.message.includes('unexpected disconnect')
                  ) {
                    console.log(
                      '[SSH] Detected early EOF or unexpected disconnect, attempting to recover',
                    );
                    // Try to keep the connection alive
                    if (remoteGitSsh.connected) {
                      console.log('[SSH] Connection still active, continuing');
                      // Don't end the stream, let it try to recover
                      return;
                    }
                  }
                  // If we can't recover, then end the stream
                  stream.write(err.toString());
                  stream.end();
                });

                // Pipe data between client and remote
                stream.on('data', (data) => {
                  console.debug('[SSH] Client -> Remote:', data.toString().slice(0, 100));
                  try {
                    remoteStream.write(data);
                  } catch (error) {
                    console.error('[SSH] Error writing to remote stream:', error);
                    // Don't end the stream on error, let it try to recover
                  }
                });

                remoteStream.on('data', (data) => {
                  console.debug('[SSH] Remote -> Client:', data.toString().slice(0, 100));
                  try {
                    stream.write(data);
                  } catch (error) {
                    console.error('[SSH] Error writing to client stream:', error);
                    // Don't end the stream on error, let it try to recover
                  }
                });

                remoteStream.on('end', () => {
                  console.log('[SSH] Remote stream ended');
                  stream.exit(0);
                  stream.end();
                });

                // Handle stream close
                remoteStream.on('close', () => {
                  console.log('[SSH] Remote stream closed');
                  // Don't end the client stream immediately, let Git protocol complete
                  // Check if we're in the middle of a large transfer
                  if (stream.readable && !stream.destroyed) {
                    console.log('[SSH] Stream still readable, not ending client stream');
                    // Let the client end the stream when it's done
                  } else {
                    console.log('[SSH] Stream not readable or destroyed, ending client stream');
                    stream.end();
                  }
                });

                remoteStream.on('exit', (code) => {
                  console.log(`[SSH] Remote command exited with code ${code}`);
                  if (code !== 0) {
                    console.error(`[SSH] Remote command failed with code ${code}`);
                  }
                  // Don't end the connection here, let the client end it
                });

                // Handle client stream end
                stream.on('end', () => {
                  console.log('[SSH] Client stream ended');
                  // End the SSH connection after a short delay to allow cleanup
                  setTimeout(() => {
                    console.log('[SSH] Ending SSH connection after client stream end');
                    remoteGitSsh.end();
                  }, 1000); // Increased delay to ensure all data is processed
                });

                // Handle client stream error
                stream.on('error', (err) => {
                  console.error('[SSH] Client stream error:', err);
                  // Don't immediately end the connection on error, try to recover
                  if (
                    err.message.includes('early EOF') ||
                    err.message.includes('unexpected disconnect')
                  ) {
                    console.log(
                      '[SSH] Detected early EOF or unexpected disconnect on client side, attempting to recover',
                    );
                    // Try to keep the connection alive
                    if (remoteGitSsh.connected) {
                      console.log('[SSH] Connection still active, continuing');
                      // Don't end the connection, let it try to recover
                      return;
                    }
                  }
                  // If we can't recover, then end the connection
                  remoteGitSsh.end();
                });

                // Handle connection end
                remoteGitSsh.on('end', () => {
                  console.log('[SSH] Remote connection ended');
                });

                // Handle connection close
                remoteGitSsh.on('close', () => {
                  console.log('[SSH] Remote connection closed');
                });

                // Add a timeout to ensure the connection is closed if it hangs
                const connectionTimeout = setTimeout(() => {
                  console.log('[SSH] Connection timeout, ending connection');
                  remoteGitSsh.end();
                }, 300000); // 5 minutes timeout for large repositories

                // Clear the timeout when the connection is closed
                remoteGitSsh.on('close', () => {
                  clearTimeout(connectionTimeout);
                });
              },
            );
          });

          remoteGitSsh.on('error', (err) => {
            console.error('[SSH] Remote SSH error:', err);

            // If authentication failed and we're using the client key, try with the proxy key
            if (
              err.message.includes('All configured authentication methods failed') &&
              clientKey &&
              connectionOptions.privateKey !==
                require('fs').readFileSync(config.getSSHConfig().hostKey.privateKeyPath)
            ) {
              console.log('[SSH] Authentication failed with client key, trying with proxy key');

              // Create a new connection with the proxy key
              const proxyGitSsh = new Client();

              // Set up connection options with proxy key
              const proxyConnectionOptions = {
                ...connectionOptions,
                privateKey: require('fs').readFileSync(
                  config.getSSHConfig().hostKey.privateKeyPath,
                ),
                // Ensure these settings are explicitly set for the proxy connection
                windowSize: 1024 * 1024, // 1MB window size
                packetSize: 32768, // 32KB packet size
                keepaliveInterval: 5000,
                keepaliveCountMax: 10,
              };

              // Set up event handlers for the proxy connection
              proxyGitSsh.on('ready', () => {
                console.log('[SSH] Connected to remote with proxy key');

                // Execute the Git command on remote
                proxyGitSsh.exec(
                  command,
                  { env: { GIT_PROTOCOL: 'version=2' } },
                  (err, remoteStream) => {
                    if (err) {
                      console.error(
                        '[SSH] Failed to execute command on remote with proxy key:',
                        err,
                      );
                      stream.write(err.toString());
                      stream.end();
                      return;
                    }

                    // Handle stream errors
                    remoteStream.on('error', (err) => {
                      console.error('[SSH] Remote stream error with proxy key:', err);
                      // Don't immediately end the stream on error, try to recover
                      if (
                        err.message.includes('early EOF') ||
                        err.message.includes('unexpected disconnect')
                      ) {
                        console.log(
                          '[SSH] Detected early EOF or unexpected disconnect with proxy key, attempting to recover',
                        );
                        // Try to keep the connection alive
                        if (proxyGitSsh.connected) {
                          console.log('[SSH] Connection still active with proxy key, continuing');
                          // Don't end the stream, let it try to recover
                          return;
                        }
                      }
                      // If we can't recover, then end the stream
                      stream.write(err.toString());
                      stream.end();
                    });

                    // Pipe data between client and remote
                    stream.on('data', (data) => {
                      console.debug('[SSH] Client -> Remote:', data.toString().slice(0, 100));
                      try {
                        remoteStream.write(data);
                      } catch (error) {
                        console.error(
                          '[SSH] Error writing to remote stream with proxy key:',
                          error,
                        );
                        // Don't end the stream on error, let it try to recover
                      }
                    });

                    remoteStream.on('data', (data) => {
                      console.debug('[SSH] Remote -> Client:', data.toString().slice(0, 20));
                      try {
                        stream.write(data);
                      } catch (error) {
                        console.error(
                          '[SSH] Error writing to client stream with proxy key:',
                          error,
                        );
                        // Don't end the stream on error, let it try to recover
                      }
                    });

                    // Handle stream close
                    remoteStream.on('close', () => {
                      console.log('[SSH] Remote stream closed with proxy key');
                      // Don't end the client stream immediately, let Git protocol complete
                      // Check if we're in the middle of a large transfer
                      if (stream.readable && !stream.destroyed) {
                        console.log(
                          '[SSH] Stream still readable with proxy key, not ending client stream',
                        );
                        // Let the client end the stream when it's done
                      } else {
                        console.log(
                          '[SSH] Stream not readable or destroyed with proxy key, ending client stream',
                        );
                        stream.end();
                      }
                    });

                    remoteStream.on('exit', (code) => {
                      console.log(`[SSH] Remote command exited with code ${code} using proxy key`);
                      // Don't end the connection here, let the client end it
                    });

                    // Handle client stream end
                    stream.on('end', () => {
                      console.log('[SSH] Client stream ended with proxy key');
                      // End the SSH connection after a short delay to allow cleanup
                      setTimeout(() => {
                        console.log(
                          '[SSH] Ending SSH connection after client stream end with proxy key',
                        );
                        proxyGitSsh.end();
                      }, 1000); // Increased delay to ensure all data is processed
                    });

                    // Handle client stream error
                    stream.on('error', (err) => {
                      console.error('[SSH] Client stream error with proxy key:', err);
                      // Don't immediately end the connection on error, try to recover
                      if (
                        err.message.includes('early EOF') ||
                        err.message.includes('unexpected disconnect')
                      ) {
                        console.log(
                          '[SSH] Detected early EOF or unexpected disconnect on client side with proxy key, attempting to recover',
                        );
                        // Try to keep the connection alive
                        if (proxyGitSsh.connected) {
                          console.log('[SSH] Connection still active with proxy key, continuing');
                          // Don't end the connection, let it try to recover
                          return;
                        }
                      }
                      // If we can't recover, then end the connection
                      proxyGitSsh.end();
                    });

                    // Handle remote stream error
                    remoteStream.on('error', (err) => {
                      console.error('[SSH] Remote stream error with proxy key:', err);
                      // Don't end the client stream immediately, let Git protocol complete
                    });

                    // Handle connection end
                    proxyGitSsh.on('end', () => {
                      console.log('[SSH] Remote connection ended with proxy key');
                    });

                    // Handle connection close
                    proxyGitSsh.on('close', () => {
                      console.log('[SSH] Remote connection closed with proxy key');
                    });

                    // Add a timeout to ensure the connection is closed if it hangs
                    const proxyConnectionTimeout = setTimeout(() => {
                      console.log('[SSH] Connection timeout with proxy key, ending connection');
                      proxyGitSsh.end();
                    }, 300000); // 5 minutes timeout for large repositories

                    // Clear the timeout when the connection is closed
                    proxyGitSsh.on('close', () => {
                      clearTimeout(proxyConnectionTimeout);
                    });
                  },
                );
              });

              proxyGitSsh.on('error', (err) => {
                console.error('[SSH] Remote SSH error with proxy key:', err);
                stream.write(err.toString());
                stream.end();
              });

              // Connect to remote with proxy key
              proxyGitSsh.connect(proxyConnectionOptions);
            } else {
              // If we're already using the proxy key or it's a different error, just end the stream
              stream.write(err.toString());
              stream.end();
            }
          });

          // Connect to remote
          console.log('[SSH] Attempting connection with options:', {
            host: connectionOptions.host,
            port: connectionOptions.port,
            username: connectionOptions.username,
            algorithms: connectionOptions.algorithms,
            privateKeyType: typeof connectionOptions.privateKey,
            privateKeyIsBuffer: Buffer.isBuffer(connectionOptions.privateKey),
          });
          remoteGitSsh.connect(connectionOptions);
        } catch (error) {
          console.error('[SSH] Error during SSH connection:', error);
          stream.write(error.toString());
          stream.end();
        }
      } else {
        console.log('[SSH] Unsupported command', command);
        stream.write('Unsupported command');
        stream.end();
      }
    });
  }

  start() {
    const port = config.getSSHConfig().port;
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`[SSH] Server listening on port ${port}`);
    });
  }
}

module.exports = SSHServer;
