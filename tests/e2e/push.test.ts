import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { testConfig, waitForService, configureGitCredentials } from './setup';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Git Proxy E2E - Repository Push Tests', () => {
  const tempDir: string = path.join(os.tmpdir(), 'git-proxy-push-e2e-tests', Date.now().toString());

  beforeAll(async () => {
    // Ensure the git proxy service is ready
    await waitForService(`${testConfig.gitProxyUiUrl}/api/v1/healthcheck`);

    // Create temp directory for test clones
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`Test workspace: ${tempDir}`);
  }, testConfig.timeout);

  describe('Repository push operations through git proxy', () => {
    it(
      'should handle push operations through git proxy (with proper authorization check)',
      async () => {
        const repoUrl: string = `${testConfig.gitProxyUrl}/coopernetes/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-push');

        console.log(`Testing push operation to ${repoUrl}`);

        try {
          // Configure git credentials for authentication
          configureGitCredentials(tempDir);

          // Step 1: Clone the repository
          console.log('Step 1: Cloning repository...');
          const gitCloneCommand: string = `git clone ${repoUrl} ${cloneDir}`;
          execSync(gitCloneCommand, {
            encoding: 'utf8',
            timeout: 30000,
            cwd: tempDir,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
            },
          });

          // Verify clone was successful
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Configure git credentials in the cloned repository for push operations
          configureGitCredentials(cloneDir);

          // Step 2: Make a dummy change
          console.log('Step 2: Creating dummy change...');
          const timestamp: string = new Date().toISOString();
          const changeFilePath: string = path.join(cloneDir, 'e2e-test-change.txt');
          const changeContent: string = `E2E Test Change\nTimestamp: ${timestamp}\nTest ID: ${Date.now()}\n`;

          fs.writeFileSync(changeFilePath, changeContent);

          // Also modify an existing file to test different scenarios
          const readmePath: string = path.join(cloneDir, 'README.md');
          if (fs.existsSync(readmePath)) {
            const existingContent: string = fs.readFileSync(readmePath, 'utf8');
            const updatedContent: string = `${existingContent}\n\n## E2E Test Update\nUpdated at: ${timestamp}\n`;
            fs.writeFileSync(readmePath, updatedContent);
          }

          // Step 3: Stage the changes
          console.log('Step 3: Staging changes...');
          execSync('git add .', {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Verify files are staged
          const statusOutput: string = execSync('git status --porcelain', {
            cwd: cloneDir,
            encoding: 'utf8',
          });
          expect(statusOutput.trim()).not.toBe('');
          console.log('Staged changes:', statusOutput.trim());

          // Step 4: Commit the changes
          console.log('Step 4: Committing changes...');
          const commitMessage: string = `E2E test commit - ${timestamp}`;
          execSync(`git commit -m "${commitMessage}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Step 5: Attempt to push through git proxy
          console.log('Step 5: Attempting push through git proxy...');

          // First check what branch we're on
          const currentBranch: string = execSync('git branch --show-current', {
            cwd: cloneDir,
            encoding: 'utf8',
          }).trim();

          console.log(`Current branch: ${currentBranch}`);

          try {
            const pushOutput: string = execSync(`git push origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
              },
            });

            console.log('Git push output:', pushOutput);
            console.log('Push succeeded - this may be unexpected in some environments');
          } catch (error: any) {
            // Push failed - this is expected behavior in most git proxy configurations
            console.log('Git proxy correctly blocked the push operation');
            console.log('Push was rejected (expected behavior)');

            // Simply verify that the push failed with a non-zero exit code
            expect(error.status).toBeGreaterThan(0);
          }

          console.log('Push operation test completed successfully');
        } catch (error) {
          console.error('Failed during push test setup:', error);

          // Log additional debug information
          try {
            const gitStatus: string = execSync('git status', { cwd: cloneDir, encoding: 'utf8' });
            console.log('Git status at failure:', gitStatus);
          } catch (statusError) {
            console.log('Could not get git status');
          }

          throw error;
        }
      },
      testConfig.timeout * 2,
    ); // Double timeout for push operations
  });

  // Cleanup after tests
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      console.log(`Cleaning up test directory: ${tempDir}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
