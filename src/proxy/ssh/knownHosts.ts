/**
 * Default SSH host keys for common Git hosting providers
 *
 * These fingerprints are the SHA256 hashes of the ED25519 host keys.
 * They should be verified against official documentation periodically.
 *
 * Sources:
 * - GitHub: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
 * - GitLab: https://docs.gitlab.com/ee/user/gitlab_com/
 */

export interface KnownHostsConfig {
  [hostname: string]: string;
}

/**
 * Default known host keys for GitHub and GitLab
 * Last updated: 2025-01-26
 */
export const DEFAULT_KNOWN_HOSTS: KnownHostsConfig = {
  'github.com': 'SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU',
  'gitlab.com': 'SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8',
};

/**
 * Get known hosts configuration with defaults merged
 */
export function getKnownHosts(customHosts?: KnownHostsConfig): KnownHostsConfig {
  return {
    ...DEFAULT_KNOWN_HOSTS,
    ...(customHosts || {}),
  };
}

/**
 * Verify a host key fingerprint against known hosts
 *
 * @param hostname The hostname being connected to
 * @param keyHash The SSH key fingerprint (e.g., "SHA256:abc123...")
 * @param knownHosts Known hosts configuration
 * @returns true if the key matches, false otherwise
 */
export function verifyHostKey(
  hostname: string,
  keyHash: string,
  knownHosts: KnownHostsConfig,
): boolean {
  const expectedKey = knownHosts[hostname];

  if (!expectedKey) {
    console.error(`[SSH] Host key verification failed: Unknown host '${hostname}'`);
    console.error(`      Add the host key to your configuration:`);
    console.error(`      "ssh": { "knownHosts": { "${hostname}": "SHA256:..." } }`);
    return false;
  }

  if (keyHash !== expectedKey) {
    console.error(`[SSH] Host key verification failed for '${hostname}'`);
    console.error(`      Expected: ${expectedKey}`);
    console.error(`      Received: ${keyHash}`);
    console.error(`      `);
    console.error(`      WARNING: This could indicate a man-in-the-middle attack!`);
    console.error(`      If the host key has legitimately changed, update your configuration.`);
    return false;
  }

  return true;
}
