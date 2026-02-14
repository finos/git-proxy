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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Action } from '../../src/proxy/actions';
import { EMPTY_COMMIT_HASH } from '../../src/proxy/processors/constants';

vi.mock('simple-git');
vi.mock('fs');

describe('checkEmptyBranch', () => {
  let exec: (req: any, action: Action) => Promise<Action>;
  let simpleGitMock: any;
  let gitRawMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    gitRawMock = vi.fn();
    simpleGitMock = vi.fn((workingDir: string) => ({
      raw: gitRawMock,
      cwd: workingDir,
    }));

    vi.doMock('simple-git', () => ({
      default: simpleGitMock,
    }));

    // mocking fs to prevent simple-git from validating directories
    vi.doMock('fs', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(true),
        lstatSync: vi.fn().mockReturnValue({
          isDirectory: () => true,
          isFile: () => false,
        }),
      };
    });

    // import the module after mocks are set up
    const checkEmptyBranch =
      await import('../../src/proxy/processors/push-action/checkEmptyBranch');
    exec = checkEmptyBranch.exec;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exec', () => {
    let action: Action;
    let req: any;

    beforeEach(() => {
      req = {};
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo');
      action.proxyGitPath = '/tmp/gitproxy';
      action.repoName = 'test-repo';
      action.commitFrom = EMPTY_COMMIT_HASH;
      action.commitTo = 'abcdef1234567890abcdef1234567890abcdef12';
      action.commitData = [];
    });

    it('should pass through if commitData is already populated', async () => {
      action.commitData = [{ message: 'Existing commit' }] as any;

      const result = await exec(req, action);

      expect(result.steps).toHaveLength(0);
      expect(simpleGitMock).not.toHaveBeenCalled();
    });

    it('should block empty branch pushes with a commit that exists', async () => {
      gitRawMock.mockResolvedValue('commit\n');

      const result = await exec(req, action);

      expect(simpleGitMock).toHaveBeenCalledWith('/tmp/gitproxy/test-repo');
      expect(gitRawMock).toHaveBeenCalledWith(['cat-file', '-t', action.commitTo]);

      const step = result.steps.find((s) => s.stepName === 'checkEmptyBranch');
      expect(step).toBeDefined();
      expect(step?.error).toBe(true);
      expect(step?.errorMessage).toContain('Push blocked: Empty branch');
    });

    it('should block pushes if commitTo does not resolve', async () => {
      gitRawMock.mockRejectedValue(new Error('fatal: Not a valid object name'));

      const result = await exec(req, action);

      expect(gitRawMock).toHaveBeenCalledWith(['cat-file', '-t', action.commitTo]);

      const step = result.steps.find((s) => s.stepName === 'checkEmptyBranch');
      expect(step).toBeDefined();
      expect(step?.error).toBe(true);
      expect(step?.errorMessage).toContain('Push blocked: Commit data not found');
    });

    it('should block non-empty branch pushes with empty commitData', async () => {
      action.commitFrom = 'abcdef1234567890abcdef1234567890abcdef12';

      const result = await exec(req, action);

      expect(simpleGitMock).not.toHaveBeenCalled();

      const step = result.steps.find((s) => s.stepName === 'checkEmptyBranch');
      expect(step).toBeDefined();
      expect(step?.error).toBe(true);
      expect(step?.errorMessage).toContain('Push blocked: Commit data not found');
    });
  });
});
