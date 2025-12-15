import { Channel } from 'ssh2';
import { EventEmitter } from 'events';

/**
 * SSH Agent Protocol Message Types
 * Based on RFC 4252 and draft-miller-ssh-agent
 */
enum AgentMessageType {
  SSH_AGENTC_REQUEST_IDENTITIES = 11,
  SSH_AGENT_IDENTITIES_ANSWER = 12,
  SSH_AGENTC_SIGN_REQUEST = 13,
  SSH_AGENT_SIGN_RESPONSE = 14,
  SSH_AGENT_FAILURE = 5,
}

/**
 * Represents a public key identity from the SSH agent
 */
export interface SSHIdentity {
  /** The public key blob in SSH wire format */
  publicKeyBlob: Buffer;
  /** Comment/description of the key */
  comment: string;
  /** Parsed key algorithm (e.g., 'ssh-ed25519', 'ssh-rsa') */
  algorithm?: string;
}

/**
 * SSH Agent Proxy
 *
 * Implements the SSH agent protocol over a forwarded SSH channel.
 * This allows the Git Proxy to request signatures from the user's
 * local ssh-agent without ever receiving the private key.
 *
 * The agent runs on the client's machine, and this proxy communicates
 * with it through the SSH connection's agent forwarding channel.
 */
export class SSHAgentProxy extends EventEmitter {
  private channel: Channel;
  private pendingResponse: ((data: Buffer) => void) | null = null;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(channel: Channel) {
    super();
    this.channel = channel;
    this.setupChannelHandlers();
  }

  /**
   * Set up handlers for data coming from the agent channel
   */
  private setupChannelHandlers(): void {
    this.channel.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processBuffer();
    });

    this.channel.on('close', () => {
      this.emit('close');
    });

    this.channel.on('error', (err: Error) => {
      console.error('[AgentProxy] Channel error:', err);
      this.emit('error', err);
    });
  }

  /**
   * Process accumulated buffer for complete messages
   * Agent protocol format: [4 bytes length][message]
   */
  private processBuffer(): void {
    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32BE(0);

      // Check if we have the complete message
      if (this.buffer.length < 4 + messageLength) {
        // Not enough data yet, wait for more
        break;
      }

      // Extract the complete message
      const message = this.buffer.slice(4, 4 + messageLength);

      // Remove processed message from buffer
      this.buffer = this.buffer.slice(4 + messageLength);

      // Handle the message
      this.handleMessage(message);
    }
  }

  /**
   * Handle a complete message from the agent
   */
  private handleMessage(message: Buffer): void {
    if (message.length === 0) {
      console.warn('[AgentProxy] Empty message from agent');
      return;
    }

    if (this.pendingResponse) {
      const resolver = this.pendingResponse;
      this.pendingResponse = null;
      resolver(message);
    }
  }

  /**
   * Send a message to the agent and wait for response
   */
  private async sendMessage(message: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const length = Buffer.allocUnsafe(4);
      length.writeUInt32BE(message.length, 0);
      const fullMessage = Buffer.concat([length, message]);

      const timeout = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Agent request timeout'));
      }, 10000);

      this.pendingResponse = (data: Buffer) => {
        clearTimeout(timeout);
        resolve(data);
      };

      // Send to agent
      this.channel.write(fullMessage);
    });
  }

  /**
   * Get list of identities (public keys) from the agent
   */
  async getIdentities(): Promise<SSHIdentity[]> {
    const message = Buffer.from([AgentMessageType.SSH_AGENTC_REQUEST_IDENTITIES]);
    const response = await this.sendMessage(message);
    const responseType = response[0];

    if (responseType === AgentMessageType.SSH_AGENT_FAILURE) {
      throw new Error('Agent returned failure for identities request');
    }

    if (responseType !== AgentMessageType.SSH_AGENT_IDENTITIES_ANSWER) {
      throw new Error(`Unexpected response type: ${responseType}`);
    }

    console.log('[AgentProxy] Identities response length: ', response.length);

    return this.parseIdentities(response);
  }

  /**
   * Parse IDENTITIES_ANSWER message
   * Format: [type:1][num_keys:4][key_blob_len:4][key_blob][comment_len:4][comment]...
   */
  private parseIdentities(response: Buffer): SSHIdentity[] {
    const identities: SSHIdentity[] = [];
    let offset = 1; // Skip message type byte

    // Read number of keys
    if (response.length < offset + 4) {
      throw new Error('Invalid identities response: too short for key count');
    }
    const numKeys = response.readUInt32BE(offset);
    offset += 4;

    for (let i = 0; i < numKeys; i++) {
      // Read key blob length
      if (response.length < offset + 4) {
        throw new Error(`Invalid identities response: missing key blob length for key ${i}`);
      }
      const blobLength = response.readUInt32BE(offset);
      offset += 4;

      // Read key blob
      if (response.length < offset + blobLength) {
        throw new Error(`Invalid identities response: incomplete key blob for key ${i}`);
      }
      const publicKeyBlob = response.slice(offset, offset + blobLength);
      offset += blobLength;

      // Read comment length
      if (response.length < offset + 4) {
        throw new Error(`Invalid identities response: missing comment length for key ${i}`);
      }
      const commentLength = response.readUInt32BE(offset);
      offset += 4;

      // Read comment
      if (response.length < offset + commentLength) {
        throw new Error(`Invalid identities response: incomplete comment for key ${i}`);
      }
      const comment = response.slice(offset, offset + commentLength).toString('utf8');
      offset += commentLength;

      // Extract algorithm from key blob (SSH wire format: [length:4][algorithm string])
      let algorithm = 'unknown';
      if (publicKeyBlob.length >= 4) {
        const algoLen = publicKeyBlob.readUInt32BE(0);
        if (publicKeyBlob.length >= 4 + algoLen) {
          algorithm = publicKeyBlob.slice(4, 4 + algoLen).toString('utf8');
        }
      }

      identities.push({ publicKeyBlob, comment, algorithm });
    }

    return identities;
  }

  /**
   * Request the agent to sign data with a specific key
   *
   * @param publicKeyBlob - The public key blob identifying which key to use
   * @param data - The data to sign
   * @param flags - Signing flags (usually 0)
   * @returns The signature blob
   */
  async sign(publicKeyBlob: Buffer, data: Buffer, flags: number = 0): Promise<Buffer> {
    // Build SIGN_REQUEST message
    // Format: [type:1][key_blob_len:4][key_blob][data_len:4][data][flags:4]
    const message = Buffer.concat([
      Buffer.from([AgentMessageType.SSH_AGENTC_SIGN_REQUEST]),
      this.encodeBuffer(publicKeyBlob),
      this.encodeBuffer(data),
      this.encodeUInt32(flags),
    ]);

    const response = await this.sendMessage(message);

    // Parse response
    const responseType = response[0];

    if (responseType === AgentMessageType.SSH_AGENT_FAILURE) {
      throw new Error('Agent returned failure for sign request');
    }

    if (responseType !== AgentMessageType.SSH_AGENT_SIGN_RESPONSE) {
      throw new Error(`Unexpected response type: ${responseType}`);
    }

    // Parse signature
    // Format: [type:1][sig_blob_len:4][sig_blob]
    if (response.length < 5) {
      throw new Error('Invalid sign response: too short');
    }

    const sigLength = response.readUInt32BE(1);
    if (response.length < 5 + sigLength) {
      throw new Error('Invalid sign response: incomplete signature');
    }

    const signatureBlob = response.slice(5, 5 + sigLength);

    // The signature blob format from the agent is: [algo_len:4][algo:string][sig_len:4][sig:bytes]
    // But ssh2 expects only the raw signature bytes (without the algorithm wrapper)
    // because Protocol.authPK will add the algorithm wrapper itself

    // Parse the blob to extract just the signature bytes
    if (signatureBlob.length < 4) {
      throw new Error('Invalid signature blob: too short for algo length');
    }

    const algoLen = signatureBlob.readUInt32BE(0);
    if (signatureBlob.length < 4 + algoLen + 4) {
      throw new Error('Invalid signature blob: too short for algo and sig length');
    }

    const sigLen = signatureBlob.readUInt32BE(4 + algoLen);
    if (signatureBlob.length < 4 + algoLen + 4 + sigLen) {
      throw new Error('Invalid signature blob: incomplete signature bytes');
    }

    // Extract ONLY the raw signature bytes (without algo wrapper)
    return signatureBlob.slice(4 + algoLen + 4, 4 + algoLen + 4 + sigLen);
  }

  /**
   * Encode a buffer with length prefix (SSH wire format)
   */
  private encodeBuffer(data: Buffer): Buffer {
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(data.length, 0);
    return Buffer.concat([length, data]);
  }

  /**
   * Encode a uint32 in big-endian format
   */
  private encodeUInt32(value: number): Buffer {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32BE(value, 0);
    return buf;
  }

  /**
   * Close the agent proxy
   */
  close(): void {
    if (this.channel && !this.channel.destroyed) {
      this.channel.close();
    }
    this.pendingResponse = null;
    this.removeAllListeners();
  }
}
