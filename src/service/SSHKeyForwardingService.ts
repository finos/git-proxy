import { SSHAgent } from '../security/SSHAgent';
import { SSHKeyManager } from '../security/SSHKeyManager';
import { getPush } from '../db';
import { simpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Service for handling SSH key forwarding during approved pushes
 */
export class SSHKeyForwardingService {
  private static sshAgent = SSHAgent.getInstance();

  /**
   * Execute an approved push using the user's retained SSH key
   * @param {string} pushId The ID of the approved push
   * @return {Promise<boolean>} True if push was successful
   */
  static async executeApprovedPush(pushId: string): Promise<boolean> {
    try {
      console.log(`[SSH Forwarding] Executing approved push ${pushId}`);

      // Get push details from database
      const push = await getPush(pushId);
      if (!push) {
        console.error(`[SSH Forwarding] Push ${pushId} not found`);
        return false;
      }

      if (!push.authorised) {
        console.error(`[SSH Forwarding] Push ${pushId} is not authorised`);
        return false;
      }

      // Check if we have SSH key information
      if (push.protocol !== 'ssh') {
        console.log(`[SSH Forwarding] Push ${pushId} is not SSH, skipping key forwarding`);
        return await this.executeHTTPSPush(push);
      }

      // Try to get the SSH key from the agent
      const privateKey = this.sshAgent.getPrivateKey(pushId);
      if (!privateKey) {
        console.warn(
          `[SSH Forwarding] No SSH key available for push ${pushId}, falling back to proxy key`,
        );
        return await this.executeSSHPushWithProxyKey(push);
      }

      // Execute the push with the user's SSH key
      return await this.executeSSHPushWithUserKey(push, privateKey);
    } catch (error) {
      console.error(`[SSH Forwarding] Failed to execute approved push ${pushId}:`, error);
      return false;
    }
  }

  /**
   * Execute SSH push using the user's private key
   * @param {any} push The push object
   * @param {Buffer} privateKey The user's SSH private key
   * @return {Promise<boolean>} True if successful
   */
  private static async executeSSHPushWithUserKey(push: any, privateKey: Buffer): Promise<boolean> {
    try {
      // Create a temporary SSH key file
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-'));
      const keyPath = path.join(tempDir, 'id_rsa');

      try {
        // Write the private key to a temporary file
        await fs.promises.writeFile(keyPath, privateKey, { mode: 0o600 });

        // Set up git with the temporary SSH key
        const originalGitSSH = process.env.GIT_SSH_COMMAND;
        process.env.GIT_SSH_COMMAND = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

        // Execute the git push
        const gitRepo = simpleGit(push.proxyGitPath);
        await gitRepo.push('origin', push.branch);

        // Restore original SSH command
        if (originalGitSSH) {
          process.env.GIT_SSH_COMMAND = originalGitSSH;
        } else {
          delete process.env.GIT_SSH_COMMAND;
        }

        console.log(
          `[SSH Forwarding] Successfully pushed using user's SSH key for push ${push.id}`,
        );
        return true;
      } finally {
        // Clean up temporary files
        try {
          await fs.promises.unlink(keyPath);
          await fs.promises.rmdir(tempDir);
        } catch (cleanupError) {
          console.warn(`[SSH Forwarding] Failed to clean up temporary files:`, cleanupError);
        }
      }
    } catch (error) {
      console.error(`[SSH Forwarding] Failed to push with user's SSH key:`, error);
      return false;
    }
  }

  /**
   * Execute SSH push using the proxy's SSH key (fallback)
   * @param {any} push The push object
   * @return {Promise<boolean>} True if successful
   */
  private static async executeSSHPushWithProxyKey(push: any): Promise<boolean> {
    try {
      const config = require('../config');
      const proxyKeyPath = config.getSSHConfig().hostKey.privateKeyPath;

      // Set up git with the proxy SSH key
      const originalGitSSH = process.env.GIT_SSH_COMMAND;
      process.env.GIT_SSH_COMMAND = `ssh -i ${proxyKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

      try {
        const gitRepo = simpleGit(push.proxyGitPath);
        await gitRepo.push('origin', push.branch);

        console.log(`[SSH Forwarding] Successfully pushed using proxy SSH key for push ${push.id}`);
        return true;
      } finally {
        // Restore original SSH command
        if (originalGitSSH) {
          process.env.GIT_SSH_COMMAND = originalGitSSH;
        } else {
          delete process.env.GIT_SSH_COMMAND;
        }
      }
    } catch (error) {
      console.error(`[SSH Forwarding] Failed to push with proxy SSH key:`, error);
      return false;
    }
  }

  /**
   * Execute HTTPS push (no SSH key needed)
   * @param {any} push The push object
   * @return {Promise<boolean>} True if successful
   */
  private static async executeHTTPSPush(push: any): Promise<boolean> {
    try {
      const gitRepo = simpleGit(push.proxyGitPath);
      await gitRepo.push('origin', push.branch);

      console.log(`[SSH Forwarding] Successfully pushed via HTTPS for push ${push.id}`);
      return true;
    } catch (error) {
      console.error(`[SSH Forwarding] Failed to push via HTTPS:`, error);
      return false;
    }
  }

  /**
   * Add SSH key to the agent for a push
   * @param {string} pushId The push ID
   * @param {Buffer} privateKey The SSH private key
   * @param {Buffer} publicKey The SSH public key
   * @param {string} comment Optional comment
   * @return {boolean} True if key was added successfully
   */
  static addSSHKeyForPush(
    pushId: string,
    privateKey: Buffer,
    publicKey: Buffer,
    comment: string = '',
  ): boolean {
    return this.sshAgent.addKey(pushId, privateKey, publicKey, comment);
  }

  /**
   * Remove SSH key from the agent after push completion
   * @param {string} pushId The push ID
   * @return {boolean} True if key was removed
   */
  static removeSSHKeyForPush(pushId: string): boolean {
    return this.sshAgent.removeKey(pushId);
  }

  /**
   * Clean up expired SSH keys
   * @return {Promise<void>} Promise that resolves when cleanup is complete
   */
  static async cleanupExpiredKeys(): Promise<void> {
    this.sshAgent.cleanupExpiredKeys();
    await SSHKeyManager.cleanupExpiredKeys();
  }
}
