/**
 * Git Protocol Handling for SSH
 *
 * This module handles the git pack protocol communication with remote Git servers (such as GitHub).
 * It manages:
 * - Fetching capabilities and refs from remote
 * - Forwarding pack data for push operations
 * - Setting up bidirectional streams for pull operations
 */

import * as ssh2 from 'ssh2';
import { ClientWithUser } from './types';
import { validateSSHPrerequisites, createSSHConnectionOptions } from './sshHelpers';
import { parsePacketLines } from '../processors/pktLineParser';

/**
 * Parser for Git pkt-line protocol
 * Git uses pkt-line format: [4 byte hex length][payload]
 * Special packet "0000" (flush packet) indicates end of section
 */
class PktLineParser {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Append data to internal buffer
   */
  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  /**
   * Check if we've received a flush packet (0000) indicating end of capabilities
   */
  hasFlushPacket(): boolean {
    try {
      const [, offset] = parsePacketLines(this.buffer);
      // If offset > 0, we successfully parsed up to and including a flush packet
      return offset > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the complete buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }
}

/**
 * Base function for executing Git commands on remote server
 * Handles all common SSH connection logic, error handling, and cleanup
 *
 * @param command - The Git command to execute
 * @param client - The authenticated client connection
 * @param remoteHost - The remote Git server hostname (e.g., 'github.com')
 * @param options - Configuration options
 * @param options.clientStream - Optional SSH stream to the client (for proxying)
 * @param options.timeoutMs - Timeout in milliseconds (default: 30000)
 * @param options.debug - Enable debug logging (default: false)
 * @param options.keepalive - Enable keepalive (default: false)
 * @param options.requireAgentForwarding - Require agent forwarding (default: true)
 * @param onStreamReady - Callback invoked when remote stream is ready
 */
async function executeRemoteGitCommand(
  command: string,
  client: ClientWithUser,
  remoteHost: string,
  options: {
    clientStream?: ssh2.ServerChannel;
    timeoutMs?: number;
    debug?: boolean;
    keepalive?: boolean;
    requireAgentForwarding?: boolean;
  },
  onStreamReady: (remoteStream: ssh2.ClientChannel, connection: ssh2.Client) => void,
): Promise<void> {
  const { requireAgentForwarding = true } = options;

  if (requireAgentForwarding) {
    validateSSHPrerequisites(client);
  }

  const { clientStream, timeoutMs = 30000, debug = false, keepalive = false } = options;
  const userName = client.authenticatedUser?.username || 'unknown';
  const connectionOptions = createSSHConnectionOptions(client, remoteHost, { debug, keepalive });

  return new Promise((resolve, reject) => {
    const remoteGitSsh = new ssh2.Client();

    const timeout = setTimeout(() => {
      console.error(`[executeRemoteGitCommand] Timeout for command: ${command}`);
      remoteGitSsh.end();
      if (clientStream) {
        clientStream.stderr.write('Connection timeout to remote server\n');
        clientStream.exit(1);
        clientStream.end();
      }
      reject(new Error('Timeout waiting for remote command'));
    }, timeoutMs);

    remoteGitSsh.on('ready', () => {
      clearTimeout(timeout);
      console.log(
        clientStream
          ? `[SSH] Connected to remote Git server for user: ${userName}`
          : `[executeRemoteGitCommand] Connected to remote`,
      );

      remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
        if (err) {
          console.error(`[executeRemoteGitCommand] Error executing command:`, err);
          remoteGitSsh.end();
          if (clientStream) {
            clientStream.stderr.write(`Remote execution error: ${err.message}\n`);
            clientStream.exit(1);
            clientStream.end();
          }
          reject(err);
          return;
        }

        console.log(
          clientStream
            ? `[SSH] Command executed on remote for user ${userName}`
            : `[executeRemoteGitCommand] Command executed: ${command}`,
        );

        try {
          onStreamReady(remoteStream, remoteGitSsh);
        } catch (callbackError) {
          console.error(`[executeRemoteGitCommand] Error in callback:`, callbackError);
          remoteGitSsh.end();
          if (clientStream) {
            clientStream.stderr.write(`Internal error: ${callbackError}\n`);
            clientStream.exit(1);
            clientStream.end();
          }
          reject(callbackError);
        }

        remoteStream.on('close', () => {
          console.log(
            clientStream
              ? `[SSH] Remote stream closed for user: ${userName}`
              : `[executeRemoteGitCommand] Stream closed`,
          );
          remoteGitSsh.end();
          if (clientStream) {
            clientStream.end();
          }
          resolve();
        });

        if (clientStream) {
          remoteStream.on('exit', (code: number, signal?: string) => {
            console.log(
              `[SSH] Remote command exited for user ${userName} with code: ${code}, signal: ${signal || 'none'}`,
            );
            clientStream.exit(code || 0);
            resolve();
          });
        }

        remoteStream.on('error', (err: Error) => {
          console.error(`[executeRemoteGitCommand] Stream error:`, err);
          remoteGitSsh.end();
          if (clientStream) {
            clientStream.stderr.write(`Stream error: ${err.message}\n`);
            clientStream.exit(1);
            clientStream.end();
          }
          reject(err);
        });
      });
    });

    remoteGitSsh.on('error', (err: Error) => {
      console.error(`[executeRemoteGitCommand] Connection error:`, err);
      clearTimeout(timeout);
      if (clientStream) {
        clientStream.stderr.write(`Connection error: ${err.message}\n`);
        clientStream.exit(1);
        clientStream.end();
      }
      reject(err);
    });

    remoteGitSsh.connect(connectionOptions);
  });
}

/**
 * Fetch capabilities and refs from git server without sending any data
 */
export async function fetchGitHubCapabilities(
  command: string,
  client: ClientWithUser,
  remoteHost: string,
): Promise<Buffer> {
  const parser = new PktLineParser();

  await executeRemoteGitCommand(
    command,
    client,
    remoteHost,
    { timeoutMs: 30000 },
    (remoteStream) => {
      remoteStream.on('data', (data: Buffer) => {
        parser.append(data);
        console.log(`[fetchCapabilities] Received ${data.length} bytes`);

        if (parser.hasFlushPacket()) {
          console.log(`[fetchCapabilities] Flush packet detected, capabilities complete`);
          remoteStream.end();
        }
      });
    },
  );

  return parser.getBuffer();
}

/**
 * Forward pack data to remote Git server (used for push operations)
 * This connects to GitHub, sends the validated pack data, and forwards responses
 */
export async function forwardPackDataToRemote(
  command: string,
  stream: ssh2.ServerChannel,
  client: ClientWithUser,
  packData: Buffer | null,
  capabilitiesSize: number,
  remoteHost: string,
): Promise<void> {
  const userName = client.authenticatedUser?.username || 'unknown';

  await executeRemoteGitCommand(
    command,
    client,
    remoteHost,
    { clientStream: stream, debug: true, keepalive: true },
    (remoteStream) => {
      console.log(`[SSH] Forwarding pack data for user ${userName}`);

      // Send pack data to GitHub
      if (packData && packData.length > 0) {
        console.log(`[SSH] Writing ${packData.length} bytes of pack data to remote`);
        remoteStream.write(packData);
      }
      remoteStream.end();

      // Skip duplicate capabilities that we already sent to client
      let bytesSkipped = 0;
      const CAPABILITY_BYTES_TO_SKIP = capabilitiesSize || 0;

      remoteStream.on('data', (data: Buffer) => {
        if (CAPABILITY_BYTES_TO_SKIP > 0 && bytesSkipped < CAPABILITY_BYTES_TO_SKIP) {
          const remainingToSkip = CAPABILITY_BYTES_TO_SKIP - bytesSkipped;

          if (data.length <= remainingToSkip) {
            bytesSkipped += data.length;
            console.log(
              `[SSH] Skipping ${data.length} bytes of capabilities (${bytesSkipped}/${CAPABILITY_BYTES_TO_SKIP})`,
            );
            return;
          } else {
            const actualResponse = data.slice(remainingToSkip);
            bytesSkipped = CAPABILITY_BYTES_TO_SKIP;
            console.log(
              `[SSH] Capabilities skipped (${CAPABILITY_BYTES_TO_SKIP} bytes), forwarding response (${actualResponse.length} bytes)`,
            );
            stream.write(actualResponse);
            return;
          }
        }
        // Forward all data after capabilities
        stream.write(data);
      });
    },
  );
}

/**
 * Connect to remote Git server and set up bidirectional stream (used for pull operations)
 * This creates a simple pipe between client and remote for pull/clone operations
 */
export async function connectToRemoteGitServer(
  command: string,
  stream: ssh2.ServerChannel,
  client: ClientWithUser,
  remoteHost: string,
): Promise<void> {
  const userName = client.authenticatedUser?.username || 'unknown';

  await executeRemoteGitCommand(
    command,
    client,
    remoteHost,
    {
      clientStream: stream,
      debug: true,
      keepalive: true,
      requireAgentForwarding: true,
    },
    (remoteStream) => {
      console.log(`[SSH] Setting up bidirectional piping for user ${userName}`);

      stream.on('data', (data: Buffer) => {
        remoteStream.write(data);
      });

      remoteStream.on('data', (data: Buffer) => {
        stream.write(data);
      });

      remoteStream.on('error', (err: Error) => {
        if (err.message.includes('early EOF') || err.message.includes('unexpected disconnect')) {
          console.log(
            `[SSH] Detected early EOF for user ${userName}, this is usually harmless during Git operations`,
          );
          return;
        }
        throw err;
      });
    },
  );
}

/**
 * Fetch repository data from remote Git server
 * Used for cloning repositories via SSH during security chain validation
 *
 * @param command - The git-upload-pack command to execute
 * @param client - The authenticated client connection
 * @param remoteHost - The remote Git server hostname (e.g., 'github.com')
 * @param request - The Git protocol request (want + deepen + done)
 * @returns Buffer containing the complete response (including PACK file)
 */
export async function fetchRepositoryData(
  command: string,
  client: ClientWithUser,
  remoteHost: string,
  request: string,
): Promise<Buffer> {
  let buffer = Buffer.alloc(0);

  await executeRemoteGitCommand(
    command,
    client,
    remoteHost,
    { timeoutMs: 60000 },
    (remoteStream) => {
      console.log(`[fetchRepositoryData] Sending request to GitHub`);

      remoteStream.write(request);

      remoteStream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });
    },
  );

  console.log(`[fetchRepositoryData] Received ${buffer.length} bytes from GitHub`);
  return buffer;
}
