import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/**
 * SSH Agent for handling user SSH keys securely during the approval process
 * This class manages SSH key forwarding without directly exposing private keys
 */
export class SSHAgent extends EventEmitter {
  private keyStore: Map<
    string,
    {
      publicKey: Buffer;
      privateKey: Buffer;
      comment: string;
      expiry: Date;
    }
  > = new Map();

  private static instance: SSHAgent;

  /**
   * Get the singleton SSH Agent instance
   * @return {SSHAgent} The SSH Agent instance
   */
  static getInstance(): SSHAgent {
    if (!SSHAgent.instance) {
      SSHAgent.instance = new SSHAgent();
    }
    return SSHAgent.instance;
  }

  /**
   * Add an SSH key temporarily to the agent
   * @param {string} pushId The push ID this key is associated with
   * @param {Buffer} privateKey The SSH private key
   * @param {Buffer} publicKey The SSH public key
   * @param {string} comment Optional comment for the key
   * @param {number} ttlHours Time to live in hours (default 24)
   * @return {boolean} True if key was added successfully
   */
  addKey(
    pushId: string,
    privateKey: Buffer,
    publicKey: Buffer,
    comment: string = '',
    ttlHours: number = 24,
  ): boolean {
    try {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + ttlHours);

      this.keyStore.set(pushId, {
        publicKey,
        privateKey,
        comment,
        expiry,
      });

      console.log(
        `[SSH Agent] Added SSH key for push ${pushId}, expires at ${expiry.toISOString()}`,
      );

      // Set up automatic cleanup
      setTimeout(
        () => {
          this.removeKey(pushId);
        },
        ttlHours * 60 * 60 * 1000,
      );

      return true;
    } catch (error) {
      console.error(`[SSH Agent] Failed to add SSH key for push ${pushId}:`, error);
      return false;
    }
  }

  /**
   * Remove an SSH key from the agent
   * @param {string} pushId The push ID associated with the key
   * @return {boolean} True if key was removed
   */
  removeKey(pushId: string): boolean {
    const keyInfo = this.keyStore.get(pushId);
    if (keyInfo) {
      // Securely clear the private key memory
      keyInfo.privateKey.fill(0);
      keyInfo.publicKey.fill(0);

      this.keyStore.delete(pushId);
      console.log(`[SSH Agent] Removed SSH key for push ${pushId}`);
      return true;
    }
    return false;
  }

  /**
   * Get an SSH key for authentication
   * @param {string} pushId The push ID associated with the key
   * @return {Buffer | null} The private key or null if not found/expired
   */
  getPrivateKey(pushId: string): Buffer | null {
    const keyInfo = this.keyStore.get(pushId);
    if (!keyInfo) {
      return null;
    }

    // Check if key has expired
    if (new Date() > keyInfo.expiry) {
      console.warn(`[SSH Agent] SSH key for push ${pushId} has expired`);
      this.removeKey(pushId);
      return null;
    }

    return keyInfo.privateKey;
  }

  /**
   * Check if a key exists for a push
   * @param {string} pushId The push ID to check
   * @return {boolean} True if key exists and is valid
   */
  hasKey(pushId: string): boolean {
    const keyInfo = this.keyStore.get(pushId);
    if (!keyInfo) {
      return false;
    }

    // Check if key has expired
    if (new Date() > keyInfo.expiry) {
      this.removeKey(pushId);
      return false;
    }

    return true;
  }

  /**
   * List all active keys (for debugging/monitoring)
   * @return {Array} Array of key information (without private keys)
   */
  listKeys(): Array<{ pushId: string; comment: string; expiry: Date }> {
    const keys: Array<{ pushId: string; comment: string; expiry: Date }> = [];

    for (const entry of Array.from(this.keyStore.entries())) {
      const [pushId, keyInfo] = entry;
      if (new Date() <= keyInfo.expiry) {
        keys.push({
          pushId,
          comment: keyInfo.comment,
          expiry: keyInfo.expiry,
        });
      } else {
        // Clean up expired key
        this.removeKey(pushId);
      }
    }

    return keys;
  }

  /**
   * Clean up all expired keys
   * @return {number} Number of keys cleaned up
   */
  cleanupExpiredKeys(): number {
    let cleanedCount = 0;
    const now = new Date();

    for (const entry of Array.from(this.keyStore.entries())) {
      const [pushId, keyInfo] = entry;
      if (now > keyInfo.expiry) {
        this.removeKey(pushId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SSH Agent] Cleaned up ${cleanedCount} expired SSH keys`);
    }

    return cleanedCount;
  }

  /**
   * Sign data with an SSH key (for SSH authentication challenges)
   * @param {string} pushId The push ID associated with the key
   * @param {Buffer} data The data to sign
   * @return {Buffer | null} The signature or null if failed
   */
  signData(pushId: string, data: Buffer): Buffer | null {
    const privateKey = this.getPrivateKey(pushId);
    if (!privateKey) {
      return null;
    }

    try {
      // Create a sign object - this is a simplified version
      // In practice, you'd need to handle different key types (RSA, Ed25519, etc.)
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      return sign.sign(privateKey);
    } catch (error) {
      console.error(`[SSH Agent] Failed to sign data for push ${pushId}:`, error);
      return null;
    }
  }

  /**
   * Clear all keys from the agent (for shutdown/cleanup)
   * @return {void}
   */
  clearAll(): void {
    for (const pushId of Array.from(this.keyStore.keys())) {
      this.removeKey(pushId);
    }
    console.log('[SSH Agent] Cleared all SSH keys');
  }
}
