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

  // Configure git credentials using URL rewriting
  const baseUrlParsed = new URL(testConfig.gitProxyBaseUrl);
  const credentialUrl = `${baseUrlParsed.protocol}//${testConfig.gitUsername}:${testConfig.gitPassword}@${baseUrlParsed.host}${baseUrlParsed.pathname}`;
  const insteadOfUrl = testConfig.gitProxyBaseUrl;

  execSync('git init', { cwd: tempDir, encoding: 'utf8' });
  execSync(`git config url."${credentialUrl}".insteadOf ${insteadOfUrl}`, {
    cwd: tempDir,
    encoding: 'utf8',
  });

  console.log(`Configured git credentials for ${insteadOfUrl}`);
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

  // Wait for the git proxy service to be ready
  // Note: Docker Compose should be started externally (e.g., in CI or manually)
  await waitForService(`${testConfig.gitProxyUrl}/health`);

  console.log('E2E test environment is ready');
}, testConfig.timeout);
