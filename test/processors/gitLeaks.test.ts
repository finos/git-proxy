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
import { Action, Step } from '../../src/proxy/actions';

vi.mock('../../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getAPIs: vi.fn(),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    default: {
      stat: vi.fn(),
      access: vi.fn(),
      constants: { R_OK: 0 },
    },
    stat: vi.fn(),
    access: vi.fn(),
    constants: { R_OK: 0 },
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

describe('gitleaks', () => {
  describe('exec', () => {
    let exec: any;
    let action: Action;
    let req: any;
    let stepSpy: any;
    let logStub: any;
    let errorStub: any;
    let getAPIs: any;
    let fsModule: any;
    let spawn: any;

    beforeEach(async () => {
      vi.clearAllMocks();

      const configModule = await import('../../src/config');
      getAPIs = configModule.getAPIs;

      const fsPromises = await import('node:fs/promises');
      fsModule = fsPromises.default || fsPromises;

      const childProcess = await import('node:child_process');
      spawn = childProcess.spawn;

      logStub = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorStub = vi.spyOn(console, 'error').mockImplementation(() => {});

      const gitleaksModule = await import('../../src/proxy/processors/push-action/gitleaks');
      exec = gitleaksModule.exec;

      req = {};
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
      action.proxyGitPath = '/tmp';
      action.repoName = 'test-repo';
      action.commitFrom = 'abc123';
      action.commitTo = 'def456';

      stepSpy = vi.spyOn(Step.prototype, 'setError');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle config loading failure', async () => {
      vi.mocked(getAPIs).mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await exec(req, action);

      expect(result.error).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepSpy).toHaveBeenCalledWith(
        'failed setup gitleaks, please contact an administrator\n',
      );
      expect(errorStub).toHaveBeenCalledWith(
        'failed to get gitleaks config, please fix the error:',
        expect.any(Error),
      );
    });

    it('should skip scanning when plugin is disabled', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: { enabled: false } });

      const result = await exec(req, action);

      expect(result.error).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(logStub).toHaveBeenCalledWith('gitleaks is disabled, skipping');
    });

    it('should handle successful scan with no findings', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: '',
      };

      const gitleaksMock = {
        exitCode: 0,
        stdout: '',
        stderr: 'No leaks found',
      };

      vi.mocked(spawn)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitRootCommitMock.stderr) },
        } as any)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitleaksMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitleaksMock.stderr) },
        } as any);

      const result = await exec(req, action);

      expect(result.error).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(logStub).toHaveBeenCalledWith('succeeded');
      expect(logStub).toHaveBeenCalledWith('No leaks found');
    });

    it('should handle scan with findings', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: '',
      };

      const gitleaksMock = {
        exitCode: 99,
        stdout: 'Found secret in file.txt\n',
        stderr: 'Warning: potential leak',
      };

      vi.mocked(spawn)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitRootCommitMock.stderr) },
        } as any)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitleaksMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitleaksMock.stderr) },
        } as any);

      const result = await exec(req, action);

      expect(result.error).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepSpy).toHaveBeenCalledWith('\nFound secret in file.txt\nWarning: potential leak');
    });

    it('should handle gitleaks execution failure', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: '',
      };

      const gitleaksMock = {
        exitCode: 1,
        stdout: '',
        stderr: 'Command failed',
      };

      vi.mocked(spawn)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitRootCommitMock.stderr) },
        } as any)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitleaksMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitleaksMock.stderr) },
        } as any);

      const result = await exec(req, action);

      expect(result.error).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepSpy).toHaveBeenCalledWith(
        'failed to run gitleaks, please contact an administrator\n',
      );
    });

    it('should handle gitleaks spawn failure', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: { enabled: true } });
      vi.mocked(spawn).mockImplementationOnce(() => {
        throw new Error('Spawn error');
      });

      const result = await exec(req, action);

      expect(result.error).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(stepSpy).toHaveBeenCalledWith(
        'failed to spawn gitleaks, please contact an administrator\n',
      );
    });

    it('should handle empty gitleaks entry in proxy.config.json', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: {} });
      const result = await exec(req, action);
      expect(result.error).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
    });

    it('should handle invalid gitleaks entry in proxy.config.json', async () => {
      vi.mocked(getAPIs).mockReturnValue({ gitleaks: 'invalid config' } as any);
      vi.mocked(spawn).mockReturnValueOnce({
        on: (event: string, cb: (exitCode: number) => void) => {
          if (event === 'close') cb(0);
          return { stdout: { on: () => {} }, stderr: { on: () => {} } };
        },
        stdout: { on: (_: string, cb: (stdout: string) => void) => cb('') },
        stderr: { on: (_: string, cb: (stderr: string) => void) => cb('') },
      } as any);

      const result = await exec(req, action);

      expect(result.error).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
    });

    it('should handle custom config path', async () => {
      vi.mocked(getAPIs).mockReturnValue({
        gitleaks: {
          enabled: true,
          configPath: `../fixtures/gitleaks-config.toml`,
        },
      });

      vi.mocked(fsModule.stat).mockResolvedValue({ isFile: () => true } as any);
      vi.mocked(fsModule.access).mockResolvedValue(undefined);

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: '',
      };

      const gitleaksMock = {
        exitCode: 0,
        stdout: '',
        stderr: 'No leaks found',
      };

      vi.mocked(spawn)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitRootCommitMock.stderr) },
        } as any)
        .mockReturnValueOnce({
          on: (event: string, cb: (exitCode: number) => void) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_: string, cb: (stdout: string) => void) => cb(gitleaksMock.stdout) },
          stderr: { on: (_: string, cb: (stderr: string) => void) => cb(gitleaksMock.stderr) },
        } as any);

      const result = await exec(req, action);

      expect(result.error).toBe(false);
      expect(result.steps[0].error).toBe(false);
      expect(vi.mocked(spawn).mock.calls[1][1]).toContain(
        '--config=../fixtures/gitleaks-config.toml',
      );
    });

    it('should handle invalid custom config path', async () => {
      vi.mocked(getAPIs).mockReturnValue({
        gitleaks: {
          enabled: true,
          configPath: '/invalid/path.toml',
        },
      });

      vi.mocked(fsModule.stat).mockRejectedValue(new Error('File not found'));

      const result = await exec(req, action);

      expect(result.error).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(true);
      expect(errorStub).toHaveBeenCalledWith(
        'could not read file at the config path provided, will not be fed to gitleaks',
      );
    });
  });
});
