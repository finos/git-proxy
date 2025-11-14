import * as crypto from 'crypto';
import * as fs from 'fs';
import { getSSHConfig } from '../config';

/**
 * Secure SSH Key Manager for temporary storage of user SSH keys during approval process
 */
export class SSHKeyManager {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_EXPIRY_HOURS = 24; // 24 hours max retention
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly AAD = Buffer.from('ssh-key-proxy');

  /**
   * Get the encryption key from environment or generate a secure one
   * @return {Buffer} The encryption key
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.SSH_KEY_ENCRYPTION_KEY;
    if (key) {
      return Buffer.from(key, 'hex');
    }

    // For development, use a key derived from the SSH host key
    const hostKeyPath = getSSHConfig().hostKey.privateKeyPath;
    const hostKey = fs.readFileSync(hostKeyPath);

    // Create a consistent key from the host key
    return crypto.createHash('sha256').update(hostKey).digest();
  }

  /**
   * Securely encrypt an SSH private key for temporary storage
   * @param {Buffer | string} privateKey The SSH private key to encrypt
   * @return {object} Object containing encrypted key and expiry time
   */
  static encryptSSHKey(privateKey: Buffer | string): {
    encryptedKey: string;
    expiryTime: Date;
  } {
    const keyBuffer = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
    const encryptionKey = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey, iv);
    cipher.setAAD(this.AAD);

    let encrypted = cipher.update(keyBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();
    const result = Buffer.concat([iv, tag, encrypted]);

    return {
      encryptedKey: result.toString('base64'),
      expiryTime: new Date(Date.now() + this.KEY_EXPIRY_HOURS * 60 * 60 * 1000),
    };
  }

  /**
   * Securely decrypt an SSH private key from storage
   * @param {string} encryptedKey The encrypted SSH key
   * @param {Date} expiryTime The expiry time of the key
   * @return {Buffer | null} The decrypted SSH key or null if failed/expired
   */
  static decryptSSHKey(encryptedKey: string, expiryTime: Date): Buffer | null {
    // Check if key has expired
    if (new Date() > expiryTime) {
      console.warn('[SSH Key Manager] SSH key has expired, cannot decrypt');
      return null;
    }

    try {
      const encryptionKey = this.getEncryptionKey();
      const data = Buffer.from(encryptedKey, 'base64');

      const iv = data.subarray(0, this.IV_LENGTH);
      const tag = data.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = data.subarray(this.IV_LENGTH + this.TAG_LENGTH);

      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey, iv);
      decipher.setAAD(this.AAD);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SSH Key Manager] Failed to decrypt SSH key:', errorMessage);
      return null;
    }
  }

  /**
   * Check if an SSH key is still valid (not expired)
   * @param {Date} expiryTime The expiry time to check
   * @return {boolean} True if key is still valid
   */
  static isKeyValid(expiryTime: Date): boolean {
    return new Date() <= expiryTime;
  }

  /**
   * Generate a secure random key for encryption (for production use)
   * @return {string} A secure random encryption key in hex format
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Clean up expired SSH keys from the database
   * @return {Promise<void>} Promise that resolves when cleanup is complete
   */
  static async cleanupExpiredKeys(): Promise<void> {
    const db = require('../db');
    const pushes = await db.getPushes();

    for (const push of pushes) {
      if (push.encryptedSSHKey && push.sshKeyExpiry && !this.isKeyValid(push.sshKeyExpiry)) {
        // Remove expired SSH key data
        push.encryptedSSHKey = undefined;
        push.sshKeyExpiry = undefined;
        await db.writeAudit(push);
        console.log(`[SSH Key Manager] Cleaned up expired SSH key for push ${push.id}`);
      }
    }
  }
}
