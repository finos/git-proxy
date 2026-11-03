/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface KnownHostsConfig {
  [hostname: string]: string;
}

/**
 * Get known hosts configuration from config
 */
export function getKnownHosts(configuredHosts?: KnownHostsConfig): KnownHostsConfig {
  return { ...(configuredHosts || {}) };
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
