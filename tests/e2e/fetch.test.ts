import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { testConfig, waitForService, configureGitCredentials } from './setup';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Git Proxy E2E - Repository Fetch Tests', () => {
  const tempDir: string = path.join(os.tmpdir(), 'git-proxy-e2e-tests', Date.now().toString());

  beforeAll(async () => {
    // Ensure the git proxy service is ready
    await waitForService(`${testConfig.gitProxyUiUrl}/api/v1/healthcheck`);

    // Create temp directory for test clones
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`Test workspace: ${tempDir}`);
  }, testConfig.timeout);

  describe('Repository fetching through git proxy', () => {
    it(
      'should successfully fetch coopernetes/test-repo through git proxy',
      async () => {
        const repoUrl: string = `${testConfig.gitProxyUrl}/coopernetes/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-clone');

        console.log(`Cloning ${repoUrl} to ${cloneDir}`);

        try {
          // Configure git credentials locally in the temp directory
          configureGitCredentials(tempDir);

          // Use git clone to fetch the repository through the proxy
          const gitCloneCommand: string = `git clone ${repoUrl} ${cloneDir}`;
          const output: string = execSync(gitCloneCommand, {
            encoding: 'utf8',
            timeout: 30000,
            cwd: tempDir,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
            },
          });

          console.log('Git clone output:', output);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Check if basic files exist (README is common in most repos)
          const readmePath: string = path.join(cloneDir, 'README.md');
          expect(fs.existsSync(readmePath)).toBe(true);

          console.log('Successfully fetched and verified coopernetes/test-repo');
        } catch (error) {
          console.error('Failed to clone repository:', error);
          throw error;
        }
      },
      testConfig.timeout,
    );

    it(
      'should successfully fetch finos/git-proxy through git proxy',
      async () => {
        const repoUrl: string = `${testConfig.gitProxyUrl}/finos/git-proxy.git`;
        const cloneDir: string = path.join(tempDir, 'git-proxy-clone');

        console.log(`Cloning ${repoUrl} to ${cloneDir}`);

        try {
          const gitCloneCommand: string = `git clone ${repoUrl} ${cloneDir}`;
          const output: string = execSync(gitCloneCommand, {
            encoding: 'utf8',
            timeout: 30000,
            cwd: tempDir,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
            },
          });

          console.log('Git clone output:', output);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Check if basic files exist (README is common in most repos)
          const readmePath: string = path.join(cloneDir, 'README.md');
          expect(fs.existsSync(readmePath)).toBe(true);

          console.log('Successfully fetched and verified finos/git-proxy');
        } catch (error) {
          console.error('Failed to clone repository:', error);
          throw error;
        }
      },
      testConfig.timeout,
    );

    it('should handle non-existent repository gracefully', async () => {
      const nonExistentRepoUrl: string = `${testConfig.gitProxyUrl}/nonexistent/repo.git`;
      const cloneDir: string = path.join(tempDir, 'non-existent-clone');

      console.log(`Attempting to clone non-existent repo: ${nonExistentRepoUrl}`);

      try {
        const gitCloneCommand: string = `git clone ${nonExistentRepoUrl} ${cloneDir}`;
        execSync(gitCloneCommand, {
          encoding: 'utf8',
          timeout: 15000,
          cwd: tempDir,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        });

        // If we get here, the clone unexpectedly succeeded
        throw new Error('Expected clone to fail for non-existent repository');
      } catch (error: any) {
        // This is expected - git clone should fail for non-existent repos
        console.log('Git clone correctly failed for non-existent repository');
        expect(error.status).toBeGreaterThan(0); // Non-zero exit code expected
        expect(fs.existsSync(cloneDir)).toBe(false); // Directory should not be created
      }
    });
  });

  // Cleanup after each test file
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      console.log(`Cleaning up test directory: ${tempDir}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
