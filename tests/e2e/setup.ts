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
import { execSync } from 'child_process';

// Environment configuration - can be overridden for different environments
export const testConfig = {
  gitProxyUrl: process.env.GIT_PROXY_URL || 'http://localhost:8000/git-server:8443',
  gitProxyUiUrl: process.env.GIT_PROXY_UI_URL || 'http://localhost:8081',
  gitServerUrl: process.env.GIT_SERVER_URL || 'https://localhost:8443',
  timeout: parseInt(process.env.E2E_TIMEOUT || '30000'),
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

const INFRA_HINT =
  'The E2E test infrastructure is not running. ' +
  'Start it with: docker compose up -d\n' +
  'See CONTRIBUTING.md for details.';

/**
 * Verifies GitProxy is reachable by hitting its healthcheck endpoint.
 * Fails immediately instead of retrying — if the infrastructure isn't
 * running we want to fail fast with a helpful message.
 */
async function checkGitProxy(): Promise<void> {
  const healthUrl = `${testConfig.gitProxyUiUrl}/api/v1/healthcheck`;
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok || response.status < 500) {
      console.log(`GitProxy is reachable at ${testConfig.gitProxyUiUrl}`);
      return;
    }
    throw new Error(`Healthcheck returned HTTP ${response.status}`);
  } catch (error: any) {
    console.error(`Error reaching GitProxy at ${healthUrl}: ${error}`);
    throw new Error(`GitProxy is not reachable at ${healthUrl}.\n${INFRA_HINT}`);
  }
}

/**
 * Verifies the local git server is reachable by running `git ls-remote`
 * against a known test repository.
 */
function checkGitServer(): void {
  const authedUrl = new URL(testConfig.gitServerUrl);
  authedUrl.username = testConfig.gitUsername;
  authedUrl.password = testConfig.gitPassword;
  authedUrl.pathname = '/test-owner/test-repo.git';
  const repoUrl = `${testConfig.gitServerUrl}/test-owner/test-repo.git`;
  try {
    execSync(`git ls-remote ${authedUrl.href}`, {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_SSL_NO_VERIFY: '1',
      },
      stdio: 'pipe',
    });
    console.log(`Git server is reachable at ${testConfig.gitServerUrl}`);
  } catch (error: any) {
    console.error(`Error reaching Git server at ${repoUrl}: ${error}`);
    throw new Error(`Git server is not reachable at ${repoUrl}.\n${INFRA_HINT}`);
  }
}

beforeAll(async () => {
  console.log('Setting up e2e test environment...');
  console.log(`Git Proxy URL: ${testConfig.gitProxyUrl}`);
  console.log(`Git Proxy UI URL: ${testConfig.gitProxyUiUrl}`);
  console.log(`Git Server URL: ${testConfig.gitServerUrl}`);
  console.log(`Git Username: ${testConfig.gitUsername}`);
  console.log(`Git Proxy Base URL: ${testConfig.gitProxyBaseUrl}`);

  // Pre-flight: verify both services are reachable before running any tests.
  // These checks fail fast so developers get a clear error instead of
  // waiting through retries when the Docker environment isn't running.
  await checkGitProxy();
  checkGitServer();

  console.log('E2E test environment is ready');
}, testConfig.timeout);
