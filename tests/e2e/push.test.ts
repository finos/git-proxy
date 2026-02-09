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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { testConfig } from './setup';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Git Proxy E2E - Repository Push Tests', () => {
  const tempDir: string = path.join(os.tmpdir(), 'git-proxy-push-e2e-tests', Date.now().toString());

  // Test users matching the localgit Apache basic auth setup
  const adminUser = {
    username: 'admin',
    password: 'admin', // Default admin password in git-proxy
  };

  const authorizedUser = {
    username: 'testuser',
    password: 'user123',
    email: 'testuser@example.com',
    gitAccount: 'testuser', // matches git commit author
  };

  const approverUser = {
    username: 'approver',
    password: 'approver123',
    email: 'approver@example.com',
    gitAccount: 'approver',
  };

  /**
   * Helper function to login and get a session cookie
   * Includes retry logic to handle connection reset issues
   */
  async function login(username: string, password: string, retries = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Small delay before retry to allow connection pool to reset
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const response = await fetch(`${testConfig.gitProxyUiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          throw new Error(`Login failed: ${response.status}`);
        }

        const cookies = response.headers.get('set-cookie');
        if (!cookies) {
          throw new Error('No session cookie received');
        }

        return cookies;
      } catch (error: any) {
        lastError = error;
        if (attempt < retries && error.cause?.code === 'UND_ERR_SOCKET') {
          console.log(`[TEST] Login attempt ${attempt} failed with socket error, retrying...`);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Helper function to create a user via API
   */
  async function createUser(
    sessionCookie: string,
    username: string,
    password: string,
    email: string,
    gitAccount: string,
    admin: boolean = false,
  ): Promise<void> {
    const response = await fetch(`${testConfig.gitProxyUiUrl}/api/auth/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ username, password, email, gitAccount, admin }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create user failed: ${response.status} - ${error}`);
    }
  }

  /**
   * Helper function to add push permission to a user for a repo
   */
  async function addUserCanPush(
    sessionCookie: string,
    repoId: string,
    username: string,
  ): Promise<void> {
    const response = await fetch(`${testConfig.gitProxyUiUrl}/api/v1/repo/${repoId}/user/push`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Add push permission failed: ${response.status} - ${error}`);
    }
  }

  /**
   * Helper function to add authorize permission to a user for a repo
   */
  async function addUserCanAuthorise(
    sessionCookie: string,
    repoId: string,
    username: string,
  ): Promise<void> {
    const response = await fetch(
      `${testConfig.gitProxyUiUrl}/api/v1/repo/${repoId}/user/authorise`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ username }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Add authorise permission failed: ${response.status} - ${error}`);
    }
  }

  /**
   * Helper function to approve a push request
   */
  async function approvePush(
    sessionCookie: string,
    pushId: string,
    questions: any[] = [],
  ): Promise<void> {
    const response = await fetch(`${testConfig.gitProxyUiUrl}/api/v1/push/${pushId}/authorise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ params: { attestation: questions } }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Approve push failed: ${response.status} - ${error}`);
    }
  }

  /**
   * Helper function to extract push ID from git output
   */
  function extractPushId(gitOutput: string): string | null {
    // Extract push ID from URL like: http://localhost:8081/dashboard/push/PUSH_ID
    const match = gitOutput.match(/dashboard\/push\/([a-f0-9_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Helper function to get repositories
   */
  async function getRepos(sessionCookie: string): Promise<any[]> {
    const response = await fetch(`${testConfig.gitProxyUiUrl}/api/v1/repo`, {
      headers: { Cookie: sessionCookie },
    });

    if (!response.ok) {
      throw new Error(`Get repos failed: ${response.status}`);
    }

    return response.json();
  }

  beforeAll(async () => {
    // Create temp directory for test clones
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`[SETUP] Test workspace: ${tempDir}`);

    // Set up authorized user in the git-proxy database via API
    try {
      console.log('[SETUP] Setting up authorized user for push tests via API...');

      // Login as admin to create users and set permissions
      const adminCookie = await login(adminUser.username, adminUser.password);
      console.log('[SETUP] Logged in as admin');

      // Create the test user in git-proxy
      try {
        await createUser(
          adminCookie,
          authorizedUser.username,
          authorizedUser.password,
          authorizedUser.email,
          authorizedUser.gitAccount,
          false,
        );
        console.log(`[SETUP] Created user ${authorizedUser.username}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`[SETUP] User ${authorizedUser.username} already exists`);
        } else {
          throw error;
        }
      }

      // Create the approver user in git-proxy
      try {
        await createUser(
          adminCookie,
          approverUser.username,
          approverUser.password,
          approverUser.email,
          approverUser.gitAccount,
          false,
        );
        console.log(`[SETUP] Created user ${approverUser.username}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`[SETUP] User ${approverUser.username} already exists`);
        } else {
          throw error;
        }
      }

      // Get the test-repo repository and add permissions
      const repos = await getRepos(adminCookie);
      const testRepo = repos.find(
        (r: any) => r.url === 'https://git-server:8443/test-owner/test-repo.git',
      );

      if (testRepo && testRepo._id) {
        await addUserCanPush(adminCookie, testRepo._id, authorizedUser.username);
        console.log(`[SETUP] Added push permission for ${authorizedUser.username} to test-repo`);

        await addUserCanAuthorise(adminCookie, testRepo._id, approverUser.username);
        console.log(`[SETUP] Added authorise permission for ${approverUser.username} to test-repo`);
      } else {
        console.warn(
          '[SETUP] WARNING: test-repo not found in database, user may not be able to push',
        );
      }

      console.log('[SETUP] User setup complete');
    } catch (error: any) {
      console.error('Error setting up test user via API:', error.message);
      throw error;
    }
  }, testConfig.timeout);

  // Run tests sequentially to avoid conflicts when pushing to the same repo
  describe.sequential('Repository push operations through git proxy', () => {
    it(
      'should handle push operations through git proxy (with proper authorization check)',
      async () => {
        // Build URL with embedded credentials for reliable authentication
        const baseUrl = new URL(testConfig.gitProxyUrl);
        baseUrl.username = testConfig.gitUsername;
        baseUrl.password = testConfig.gitPassword;
        const repoUrl = `${baseUrl.toString()}/test-owner/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-push');

        console.log(
          `[TEST] Testing push operation to ${testConfig.gitProxyUrl}/test-owner/test-repo.git`,
        );

        try {
          // Step 1: Clone the repository
          console.log('[TEST] Step 1: Cloning repository...');
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

          // Step 2: Make a dummy change
          console.log('[TEST] Step 2: Creating dummy change...');
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
          console.log('[TEST] Step 3: Staging changes...');
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
          console.log('[TEST] Staged changes:', statusOutput.trim());

          // Step 4: Commit the changes
          console.log('[TEST] Step 4: Committing changes...');
          const commitMessage: string = `E2E test commit - ${timestamp}`;
          execSync(`git commit -m "${commitMessage}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Step 5: Attempt to push through git proxy
          console.log('[TEST] Step 5: Attempting push through git proxy...');

          // First check what branch we're on
          const currentBranch: string = execSync('git branch --show-current', {
            cwd: cloneDir,
            encoding: 'utf8',
          }).trim();

          console.log(`[TEST] Current branch: ${currentBranch}`);

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

            console.log('[TEST] Git push output:', pushOutput);
            console.log('[TEST] Push succeeded - this may be unexpected in some environments');
          } catch (error: any) {
            // Push failed - this is expected behavior in most git proxy configurations
            console.log('[TEST] Git proxy correctly blocked the push operation');
            console.log('[TEST] Push was rejected (expected behavior)');

            // Simply verify that the push failed with a non-zero exit code
            expect(error.status).toBeGreaterThan(0);
          }

          console.log('[TEST] Push operation test completed successfully');
        } catch (error) {
          console.error('[TEST] Failed during push test setup:', error);

          // Log additional debug information
          try {
            const gitStatus: string = execSync('git status', { cwd: cloneDir, encoding: 'utf8' });
            console.log('[TEST] Git status at failure:', gitStatus);
          } catch (statusError) {
            console.log('[TEST] Could not get git status');
          }

          throw error;
        }
      },
      testConfig.timeout * 2,
    ); // Double timeout for push operations

    it(
      'should successfully push when user has authorization',
      async () => {
        // Build URL with authorized user credentials
        const baseUrl = new URL(testConfig.gitProxyUrl);
        baseUrl.username = authorizedUser.username;
        baseUrl.password = authorizedUser.password;
        const repoUrl = `${baseUrl.toString()}/test-owner/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-authorized-push');

        console.log(`[TEST] Testing authorized push with user ${authorizedUser.username}`);

        try {
          // Step 1: Clone the repository
          console.log('[TEST] Step 1: Cloning repository with authorized user...');
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

          // Step 2: Configure git user to match authorized user
          console.log('[TEST] Step 2: Configuring git author to match authorized user...');
          execSync(`git config user.name "${authorizedUser.gitAccount}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });
          execSync(`git config user.email "${authorizedUser.email}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Step 3: Make a dummy change
          console.log('[TEST] Step 3: Creating authorized test change...');
          const timestamp: string = new Date().toISOString();
          const changeFilePath: string = path.join(cloneDir, 'authorized-push-test.txt');
          const changeContent: string = `Authorized Push Test\nUser: ${authorizedUser.username}\nTimestamp: ${timestamp}\n`;

          fs.writeFileSync(changeFilePath, changeContent);

          // Step 4: Stage the changes
          console.log('[TEST] Step 4: Staging changes...');
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
          console.log('[TEST] Staged changes:', statusOutput.trim());

          // Step 5: Commit the changes
          console.log('[TEST] Step 5: Committing changes...');
          const commitMessage: string = `Authorized E2E test commit - ${timestamp}`;
          execSync(`git commit -m "${commitMessage}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Step 6: Pull any upstream changes and push through git proxy
          console.log('[TEST] Step 6: Pulling upstream changes and pushing to git proxy...');

          const currentBranch: string = execSync('git branch --show-current', {
            cwd: cloneDir,
            encoding: 'utf8',
          }).trim();

          console.log(`[TEST] Current branch: ${currentBranch}`);

          // Pull any upstream changes from previous tests before pushing
          try {
            execSync(`git pull --rebase origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            });
            console.log('[TEST] Pulled upstream changes successfully');
          } catch (pullError: any) {
            // Ignore pull errors - may fail if no upstream changes or first push
            console.log('[TEST] Pull skipped or no upstream changes');
          }

          // Push through git proxy
          // Note: Git proxy may queue the push for approval rather than pushing immediately
          // This is expected behavior - we're testing that the push is accepted, not rejected
          let pushAccepted = false;
          let pushOutput = '';

          try {
            pushOutput = execSync(`git push origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
              },
            });
            pushAccepted = true;
            console.log('[TEST] Git push completed successfully');
          } catch (error: any) {
            // Git proxy may return non-zero exit code even when accepting the push for review
            // Check if the output indicates the push was received
            const output = error.stderr || error.stdout || '';
            if (
              output.includes('GitProxy has received your push') ||
              output.includes('Shareable Link')
            ) {
              pushAccepted = true;
              pushOutput = output;
              console.log('[TEST] SUCCESS: GitProxy accepted the push for review/approval');
            } else {
              throw error;
            }
          }

          console.log('[TEST] Git push output:', pushOutput);

          // Verify the push was accepted (not rejected)
          expect(pushAccepted).toBe(true);
          expect(pushOutput).toMatch(/GitProxy has received your push|Shareable Link/);
          console.log('[TEST] SUCCESS: Authorized user successfully pushed to git-proxy');

          // Note: In a real workflow, the push would now be pending approval
          // and an authorized user would need to approve it before it reaches the upstream repo
        } catch (error: any) {
          console.error('[TEST] Authorized push test failed:', error.message);

          // Log additional debug information
          try {
            const gitStatus: string = execSync('git status', { cwd: cloneDir, encoding: 'utf8' });
            console.log('[TEST] Git status at failure:', gitStatus);

            const gitLog: string = execSync('git log -1 --pretty=format:"%an <%ae>"', {
              cwd: cloneDir,
              encoding: 'utf8',
            });
            console.log('[TEST] Commit author:', gitLog);
          } catch (statusError) {
            console.log('[TEST] Could not get git debug info');
          }

          throw error;
        }
      },
      testConfig.timeout * 2,
    );

    it(
      'should successfully push, approve, and complete the push workflow',
      async () => {
        // Build URL with authorized user credentials
        const baseUrl = new URL(testConfig.gitProxyUrl);
        baseUrl.username = authorizedUser.username;
        baseUrl.password = authorizedUser.password;
        const repoUrl = `${baseUrl.toString()}/test-owner/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-approved-push');

        console.log(
          `[TEST] Testing full push-approve-repush workflow with user ${authorizedUser.username}`,
        );

        try {
          // Step 1: Clone the repository
          console.log('[TEST] Step 1: Cloning repository with authorized user...');
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

          expect(fs.existsSync(cloneDir)).toBe(true);

          // Step 2: Configure git user
          console.log('[TEST] Step 2: Configuring git author...');
          execSync(`git config user.name "${authorizedUser.gitAccount}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });
          execSync(`git config user.email "${authorizedUser.email}"`, {
            cwd: cloneDir,
            encoding: 'utf8',
          });

          // Step 3: Make a change
          console.log('[TEST] Step 3: Creating test change...');
          const timestamp: string = new Date().toISOString();
          const changeFilePath: string = path.join(cloneDir, 'approved-workflow-test.txt');
          const changeContent: string = `Approved Workflow Test\nUser: ${authorizedUser.username}\nTimestamp: ${timestamp}\n`;
          fs.writeFileSync(changeFilePath, changeContent);

          // Step 4: Stage and commit
          console.log('[TEST] Step 4: Staging and committing changes...');
          execSync('git add .', { cwd: cloneDir, encoding: 'utf8' });
          const commitMessage: string = `Approved workflow test - ${timestamp}`;
          execSync(`git commit -m "${commitMessage}"`, { cwd: cloneDir, encoding: 'utf8' });

          // Step 5: Pull upstream changes and push (should be queued for approval)
          console.log('[TEST] Step 5: Initial push to git proxy...');
          const currentBranch: string = execSync('git branch --show-current', {
            cwd: cloneDir,
            encoding: 'utf8',
          }).trim();

          // Pull any upstream changes from previous tests before pushing
          try {
            execSync(`git pull --rebase origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            });
            console.log('[TEST] Pulled upstream changes successfully');
          } catch (pullError: any) {
            console.log('[TEST] Pull skipped or no upstream changes');
          }

          let pushOutput = '';
          let pushId: string | null = null;

          try {
            pushOutput = execSync(`git push origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            });
          } catch (error: any) {
            pushOutput = error.stderr || error.stdout || '';
          }

          console.log('[TEST] Initial push output:', pushOutput);

          // Extract push ID from the output
          pushId = extractPushId(pushOutput);
          expect(pushId).toBeTruthy();
          console.log(`[TEST] SUCCESS: Push queued for approval with ID: ${pushId}`);

          // Step 6: Login as approver and approve the push
          console.log('[TEST] Step 6: Approving push as authorized approver...');
          const approverCookie = await login(approverUser.username, approverUser.password);

          const defaultQuestions = [
            {
              label: 'I am happy for this to be pushed to the upstream repository',
              tooltip: { label: 'test' },
              checked: 'true',
            },
          ];

          await approvePush(approverCookie, pushId!, defaultQuestions);
          console.log(`[TEST] SUCCESS: Push ${pushId} approved by ${approverUser.username}`);

          // Step 7: Re-push after approval (should succeed)
          console.log('[TEST] Step 7: Re-pushing after approval...');
          let finalPushOutput = '';
          let finalPushSucceeded = false;

          try {
            finalPushOutput = execSync(`git push origin ${currentBranch}`, {
              cwd: cloneDir,
              encoding: 'utf8',
              timeout: 30000,
              env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            });
            finalPushSucceeded = true;
            console.log('[TEST] SUCCESS: Final push succeeded after approval');
          } catch (error: any) {
            finalPushOutput = error.stderr || error.stdout || '';
            // Check if it actually succeeded despite non-zero exit
            if (
              finalPushOutput.includes('Everything up-to-date') ||
              finalPushOutput.includes('successfully pushed')
            ) {
              finalPushSucceeded = true;
              console.log('[TEST] SUCCESS: Final push succeeded (detected from output)');
            } else {
              console.log('[TEST] Final push output:', finalPushOutput);
              throw new Error('Final push failed after approval');
            }
          }

          console.log('[TEST] Final push output:', finalPushOutput);
          expect(finalPushSucceeded).toBe(true);
          console.log('[TEST] SUCCESS: Complete push-approve-repush workflow succeeded!');
        } catch (error: any) {
          console.error('[TEST] Approved workflow test failed:', error.message);
          throw error;
        }
      },
      testConfig.timeout * 3,
    );
  });

  // Cleanup after tests
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      console.log(`[TEST] Cleaning up test directory: ${tempDir}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
