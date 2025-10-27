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

describe('Git Proxy E2E - Repository Fetch Tests', () => {
  const tempDir: string = path.join(os.tmpdir(), 'git-proxy-e2e-tests', Date.now().toString());

  beforeAll(async () => {
    // Create temp directory for test clones
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`[SETUP] Test workspace: ${tempDir}`);
  }, testConfig.timeout);

  describe('Repository fetching through git proxy', () => {
    it(
      'should successfully fetch coopernetes/test-repo through git proxy',
      async () => {
        // Build URL with embedded credentials for reliable authentication
        const baseUrl = new URL(testConfig.gitProxyUrl);
        baseUrl.username = testConfig.gitUsername;
        baseUrl.password = testConfig.gitPassword;
        const repoUrl = `${baseUrl.toString()}/coopernetes/test-repo.git`;
        const cloneDir: string = path.join(tempDir, 'test-repo-clone');

        console.log(
          `[TEST] Cloning ${testConfig.gitProxyUrl}/coopernetes/test-repo.git to ${cloneDir}`,
        );

        try {
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

          console.log('[TEST] Git clone output:', output);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Check if basic files exist (README is common in most repos)
          const readmePath: string = path.join(cloneDir, 'README.md');
          expect(fs.existsSync(readmePath)).toBe(true);

          console.log('[TEST] Successfully fetched and verified coopernetes/test-repo');
        } catch (error) {
          console.error('[TEST] Failed to clone repository:', error);
          throw error;
        }
      },
      testConfig.timeout,
    );

    it(
      'should successfully fetch finos/git-proxy through git proxy',
      async () => {
        // Build URL with embedded credentials for reliable authentication
        const baseUrl = new URL(testConfig.gitProxyUrl);
        baseUrl.username = testConfig.gitUsername;
        baseUrl.password = testConfig.gitPassword;
        const repoUrl = `${baseUrl.toString()}/finos/git-proxy.git`;
        const cloneDir: string = path.join(tempDir, 'git-proxy-clone');

        console.log(`[TEST] Cloning ${testConfig.gitProxyUrl}/finos/git-proxy.git to ${cloneDir}`);

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

          console.log('[TEST] Git clone output:', output);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Verify the repository was cloned successfully
          expect(fs.existsSync(cloneDir)).toBe(true);
          expect(fs.existsSync(path.join(cloneDir, '.git'))).toBe(true);

          // Check if basic files exist (README is common in most repos)
          const readmePath: string = path.join(cloneDir, 'README.md');
          expect(fs.existsSync(readmePath)).toBe(true);

          console.log('[TEST] Successfully fetched and verified finos/git-proxy');
        } catch (error) {
          console.error('[TEST] Failed to clone repository:', error);
          throw error;
        }
      },
      testConfig.timeout,
    );

    it('should handle non-existent repository gracefully', async () => {
      const nonExistentRepoUrl: string = `${testConfig.gitProxyUrl}/nonexistent/repo.git`;
      const cloneDir: string = path.join(tempDir, 'non-existent-clone');

      console.log(`[TEST] Attempting to clone non-existent repo: ${nonExistentRepoUrl}`);

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
        console.log('[TEST] Git clone correctly failed for non-existent repository');
        expect(error.status).toBeGreaterThan(0); // Non-zero exit code expected
        expect(fs.existsSync(cloneDir)).toBe(false); // Directory should not be created
      }
    });
  });

  // Cleanup after each test file
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      console.log(`[TEST] Cleaning up test directory: ${tempDir}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
