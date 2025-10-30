/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeAll } from 'vitest';

// Environment configuration - can be overridden for different environments
export const testConfig = {
  gitProxyUrl: process.env.GIT_PROXY_URL || 'http://localhost:8000/git-server:8080',
  gitProxyUiUrl: process.env.GIT_PROXY_UI_URL || 'http://localhost:8081',
  timeout: parseInt(process.env.E2E_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.E2E_MAX_RETRIES || '30'),
  retryDelay: parseInt(process.env.E2E_RETRY_DELAY || '2000'),
  // Git credentials for authentication
  gitUsername: process.env.GIT_USERNAME || 'admin',
  gitPassword: process.env.GIT_PASSWORD || 'admin123',
  // Base URL for git credential configuration (without credentials)
  // Should match the protocol and host of gitProxyUrl
  gitProxyBaseUrl:
    process.env.GIT_PROXY_BASE_URL ||
    (process.env.GIT_PROXY_URL
      ? new URL(process.env.GIT_PROXY_URL).origin + '/'
      : 'http://localhost:8000/'),
};

/**
 * Configures git credentials for authentication in a temporary directory
 * @param {string} tempDir - The temporary directory to configure git in
 */
export function configureGitCredentials(tempDir: string): void {
  const { execSync } = require('child_process');

  try {
    // Configure git credentials using URL rewriting
    const baseUrlParsed = new URL(testConfig.gitProxyBaseUrl);

    // Initialize git if not already done
    try {
      execSync('git rev-parse --git-dir', { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' });
    } catch {
      execSync('git init', { cwd: tempDir, encoding: 'utf8' });
    }

    // Configure multiple URL patterns to catch all variations
    const patterns = [
      // Most important: the proxy server itself (this is what's asking for auth)
      {
        insteadOf: `${baseUrlParsed.protocol}//${baseUrlParsed.host}`,
        credUrl: `${baseUrlParsed.protocol}//${testConfig.gitUsername}:${testConfig.gitPassword}@${baseUrlParsed.host}`,
      },
      // Base URL with trailing slash
      {
        insteadOf: testConfig.gitProxyBaseUrl,
        credUrl: `${baseUrlParsed.protocol}//${testConfig.gitUsername}:${testConfig.gitPassword}@${baseUrlParsed.host}${baseUrlParsed.pathname}`,
      },
      // Base URL without trailing slash
      {
        insteadOf: testConfig.gitProxyBaseUrl.replace(/\/$/, ''),
        credUrl: `${baseUrlParsed.protocol}//${testConfig.gitUsername}:${testConfig.gitPassword}@${baseUrlParsed.host}`,
      },
    ];

    for (const pattern of patterns) {
      execSync(`git config url."${pattern.credUrl}".insteadOf "${pattern.insteadOf}"`, {
        cwd: tempDir,
        encoding: 'utf8',
      });
    }
  } catch (error) {
    console.error('Failed to configure git credentials:', error);
    throw error;
  }
}

export async function waitForService(
  url: string,
  maxAttempts?: number,
  delay?: number,
): Promise<void> {
  const attempts = maxAttempts || testConfig.maxRetries;
  const retryDelay = delay || testConfig.retryDelay;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok || response.status < 500) {
        console.log(`Service at ${url} is ready`);
        return;
      }
    } catch (error) {
      // Service not ready yet
    }

    if (i < attempts - 1) {
      console.log(`Waiting for service at ${url}... (attempt ${i + 1}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Service at ${url} failed to become ready after ${attempts} attempts`);
}

beforeAll(async () => {
  console.log('Setting up e2e test environment...');
  console.log(`Git Proxy URL: ${testConfig.gitProxyUrl}`);
  console.log(`Git Proxy UI URL: ${testConfig.gitProxyUiUrl}`);
  console.log(`Git Username: ${testConfig.gitUsername}`);
  console.log(`Git Proxy Base URL: ${testConfig.gitProxyBaseUrl}`);

  // Wait for the git proxy UI service to be ready
  // Note: Docker Compose should be started externally (e.g., in CI or manually)
  await waitForService(`${testConfig.gitProxyUiUrl}/api/v1/healthcheck`);

  console.log('E2E test environment is ready');
}, testConfig.timeout);
