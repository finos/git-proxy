import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * SSH Host Key Manager
 *
 * The SSH host key identifies the Git Proxy server to clients connecting via SSH.
 * This is analogous to an SSL certificate for HTTPS servers.
 *
 * IMPORTANT: This key is NOT used for authenticating to remote Git servers (GitHub/GitLab).
 * With SSH agent forwarding, the proxy uses the client's SSH keys for remote authentication.
 *
 * Purpose of the host key:
 * - Identifies the proxy server to SSH clients (developers)
 * - Prevents MITM attacks (clients verify this key hasn't changed)
 * - Required by the SSH protocol - every SSH server must have a host key
 */

export interface HostKeyConfig {
  privateKeyPath: string;
  publicKeyPath: string;
}

/**
 * Ensures the SSH host key exists, generating it automatically if needed.
 *
 * The host key is used ONLY to identify the proxy server to connecting clients.
 * It is NOT used for authenticating to GitHub/GitLab (agent forwarding handles that).
 *
 * @param config - Host key configuration with paths
 * @returns Buffer containing the private key
 * @throws Error if generation fails or key cannot be read
 */
export function ensureHostKey(config: HostKeyConfig): Buffer {
  const { privateKeyPath, publicKeyPath } = config;

  // Validate paths to prevent command injection
  // Only allow alphanumeric, dots, slashes, underscores, hyphens
  const safePathRegex = /^[a-zA-Z0-9._\-\/]+$/;
  if (!safePathRegex.test(privateKeyPath) || !safePathRegex.test(publicKeyPath)) {
    throw new Error(
      `Invalid SSH host key path: paths must contain only alphanumeric characters, dots, slashes, underscores, and hyphens`,
    );
  }

  // Check if the private key already exists
  if (fs.existsSync(privateKeyPath)) {
    console.log(`[SSH] Using existing proxy host key: ${privateKeyPath}`);
    try {
      return fs.readFileSync(privateKeyPath);
    } catch (error) {
      throw new Error(
        `Failed to read existing SSH host key at ${privateKeyPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Generate a new host key
  console.log(`[SSH] Proxy host key not found at ${privateKeyPath}`);
  console.log('[SSH] Generating new SSH host key for the proxy server...');
  console.log('[SSH] Note: This key identifies the proxy to connecting clients (like an SSL certificate)');

  try {
    // Create directory if it doesn't exist
    const keyDir = path.dirname(privateKeyPath);
    if (!fs.existsSync(keyDir)) {
      console.log(`[SSH] Creating directory: ${keyDir}`);
      fs.mkdirSync(keyDir, { recursive: true });
    }

    // Generate Ed25519 key (modern, secure, and fast)
    // Ed25519 is preferred over RSA for:
    // - Smaller key size (68 bytes vs 2048+ bits)
    // - Faster key generation
    // - Better security properties
    console.log('[SSH] Generating Ed25519 host key...');
    execSync(
      `ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "git-proxy-host-key"`,
      {
        stdio: 'pipe', // Suppress ssh-keygen output
        timeout: 10000, // 10 second timeout
      },
    );

    console.log(`[SSH] ✓ Successfully generated proxy host key`);
    console.log(`[SSH]   Private key: ${privateKeyPath}`);
    console.log(`[SSH]   Public key:  ${publicKeyPath}`);
    console.log('[SSH]');
    console.log('[SSH] IMPORTANT: This key identifies YOUR proxy server to clients.');
    console.log('[SSH] When clients first connect, they will be prompted to verify this key.');
    console.log('[SSH] Keep the private key secure and do not share it.');

    // Verify the key was created and read it
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error('Key generation appeared to succeed but private key file not found');
    }

    return fs.readFileSync(privateKeyPath);
  } catch (error) {
    // If generation fails, provide helpful error message
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error('[SSH] Failed to generate host key');
    console.error(`[SSH] Error: ${errorMessage}`);
    console.error('[SSH]');
    console.error('[SSH] To fix this, you can either:');
    console.error('[SSH] 1. Install ssh-keygen (usually part of OpenSSH)');
    console.error('[SSH] 2. Manually generate a key:');
    console.error(`[SSH]    ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "git-proxy-host-key"`);
    console.error('[SSH] 3. Disable SSH in proxy.config.json: "ssh": { "enabled": false }');

    throw new Error(
      `Failed to generate SSH host key: ${errorMessage}. See console for details.`,
    );
  }
}

/**
 * Validates that a host key file exists and is readable.
 * This is a non-invasive check that doesn't generate keys.
 *
 * @param keyPath - Path to the key file
 * @returns true if the key exists and is readable
 */
export function validateHostKeyExists(keyPath: string): boolean {
  try {
    fs.accessSync(keyPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
