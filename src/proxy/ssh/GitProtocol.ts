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
 * Fetch capabilities and refs from GitHub without sending any data
 * This allows us to validate data BEFORE sending to GitHub
 */
export async function fetchGitHubCapabilities(
  command: string,
  client: ClientWithUser,
): Promise<Buffer> {
  validateSSHPrerequisites(client);
  const connectionOptions = createSSHConnectionOptions(client);

  return new Promise((resolve, reject) => {
    const remoteGitSsh = new ssh2.Client();
    const parser = new PktLineParser();

    // Safety timeout (should never be reached)
    const timeout = setTimeout(() => {
      console.error(`[fetchCapabilities] Timeout waiting for capabilities`);
      remoteGitSsh.end();
      reject(new Error('Timeout waiting for capabilities from remote'));
    }, 30000); // 30 seconds

    remoteGitSsh.on('ready', () => {
      console.log(`[fetchCapabilities] Connected to GitHub`);

      remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
        if (err) {
          console.error(`[fetchCapabilities] Error executing command:`, err);
          clearTimeout(timeout);
          remoteGitSsh.end();
          reject(err);
          return;
        }

        console.log(`[fetchCapabilities] Command executed, waiting for capabilities`);

        // Single data handler that checks for flush packet
        remoteStream.on('data', (data: Buffer) => {
          parser.append(data);
          console.log(`[fetchCapabilities] Received ${data.length} bytes`);

          if (parser.hasFlushPacket()) {
            console.log(`[fetchCapabilities] Flush packet detected, capabilities complete`);
            clearTimeout(timeout);
            remoteStream.end();
            remoteGitSsh.end();
            resolve(parser.getBuffer());
          }
        });

        remoteStream.on('error', (err: Error) => {
          console.error(`[fetchCapabilities] Stream error:`, err);
          clearTimeout(timeout);
          remoteGitSsh.end();
          reject(err);
        });
      });
    });

    remoteGitSsh.on('error', (err: Error) => {
      console.error(`[fetchCapabilities] Connection error:`, err);
      clearTimeout(timeout);
      reject(err);
    });

    remoteGitSsh.connect(connectionOptions);
  });
}

/**
 * Base function for executing Git commands on remote server
 * Handles all common SSH connection logic, error handling, and cleanup
 * Delegates stream-specific behavior to the provided callback
 *
 * @param command - The Git command to execute
 * @param clientStream - The SSH stream to the client
 * @param client - The authenticated client connection
 * @param onRemoteStreamReady - Callback invoked when remote stream is ready
 */
async function executeGitCommandOnRemote(
  command: string,
  clientStream: ssh2.ServerChannel,
  client: ClientWithUser,
  onRemoteStreamReady: (remoteStream: ssh2.ClientChannel) => void,
): Promise<void> {
  validateSSHPrerequisites(client);

  const userName = client.authenticatedUser?.username || 'unknown';
  const connectionOptions = createSSHConnectionOptions(client, { debug: true, keepalive: true });

  return new Promise((resolve, reject) => {
    const remoteGitSsh = new ssh2.Client();

    const connectTimeout = setTimeout(() => {
      console.error(`[SSH] Connection timeout to remote for user ${userName}`);
      remoteGitSsh.end();
      clientStream.stderr.write('Connection timeout to remote server\n');
      clientStream.exit(1);
      clientStream.end();
      reject(new Error('Connection timeout'));
    }, 30000);

    remoteGitSsh.on('ready', () => {
      clearTimeout(connectTimeout);
      console.log(`[SSH] Connected to remote Git server for user: ${userName}`);

      remoteGitSsh.exec(command, (err: Error | undefined, remoteStream: ssh2.ClientChannel) => {
        if (err) {
          console.error(`[SSH] Error executing command on remote for user ${userName}:`, err);
          clientStream.stderr.write(`Remote execution error: ${err.message}\n`);
          clientStream.exit(1);
          clientStream.end();
          remoteGitSsh.end();
          reject(err);
          return;
        }

        console.log(`[SSH] Command executed on remote for user ${userName}`);

        remoteStream.on('close', () => {
          console.log(`[SSH] Remote stream closed for user: ${userName}`);
          clientStream.end();
          remoteGitSsh.end();
          console.log(`[SSH] Remote connection closed for user: ${userName}`);
          resolve();
        });

        remoteStream.on('exit', (code: number, signal?: string) => {
          console.log(
            `[SSH] Remote command exited for user ${userName} with code: ${code}, signal: ${signal || 'none'}`,
          );
          clientStream.exit(code || 0);
          resolve();
        });

        remoteStream.on('error', (err: Error) => {
          console.error(`[SSH] Remote stream error for user ${userName}:`, err);
          clientStream.stderr.write(`Stream error: ${err.message}\n`);
          clientStream.exit(1);
          clientStream.end();
          remoteGitSsh.end();
          reject(err);
        });

        try {
          onRemoteStreamReady(remoteStream);
        } catch (callbackError) {
          console.error(`[SSH] Error in stream callback for user ${userName}:`, callbackError);
          clientStream.stderr.write(`Internal error: ${callbackError}\n`);
          clientStream.exit(1);
          clientStream.end();
          remoteGitSsh.end();
          reject(callbackError);
        }
      });
    });

    remoteGitSsh.on('error', (err: Error) => {
      console.error(`[SSH] Remote connection error for user ${userName}:`, err);
      clearTimeout(connectTimeout);
      clientStream.stderr.write(`Connection error: ${err.message}\n`);
      clientStream.exit(1);
      clientStream.end();
      reject(err);
    });

    remoteGitSsh.connect(connectionOptions);
  });
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
  capabilitiesSize?: number,
): Promise<void> {
  const userName = client.authenticatedUser?.username || 'unknown';

  await executeGitCommandOnRemote(command, stream, client, (remoteStream) => {
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
  });
}

/**
 * Connect to remote Git server and set up bidirectional stream (used for pull operations)
 * This creates a simple pipe between client and remote for pull/clone operations
 */
export async function connectToRemoteGitServer(
  command: string,
  stream: ssh2.ServerChannel,
  client: ClientWithUser,
): Promise<void> {
  const userName = client.authenticatedUser?.username || 'unknown';

  await executeGitCommandOnRemote(command, stream, client, (remoteStream) => {
    console.log(`[SSH] Setting up bidirectional piping for user ${userName}`);

    // Pipe client data to remote
    stream.on('data', (data: Buffer) => {
      remoteStream.write(data);
    });

    // Pipe remote data to client
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
      // Re-throw other errors
      throw err;
    });
  });
}
