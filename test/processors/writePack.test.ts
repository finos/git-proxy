import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Action, Step } from '../../src/proxy/actions';
import * as childProcess from 'child_process';
import * as fs from 'fs';

vi.mock('child_process');
vi.mock('fs');

describe('writePack', () => {
  let exec: typeof import('../../src/proxy/processors/push-action/writePack').exec;
  let readdirSyncMock: ReturnType<typeof vi.fn>;
  let spawnSyncMock: ReturnType<typeof vi.fn>;
  let stepLogSpy: ReturnType<typeof vi.spyOn>;
  let stepSetContentSpy: ReturnType<typeof vi.spyOn>;
  let stepSetErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    spawnSyncMock = vi.mocked(childProcess.spawnSync);
    readdirSyncMock = vi.mocked(fs.readdirSync);
    readdirSyncMock.mockReturnValueOnce(['old1.idx']).mockReturnValueOnce(['old1.idx', 'new1.idx']);

    stepLogSpy = vi.spyOn(Step.prototype, 'log');
    stepSetContentSpy = vi.spyOn(Step.prototype, 'setContent');
    stepSetErrorSpy = vi.spyOn(Step.prototype, 'setError');

    const writePack = await import('../../src/proxy/processors/push-action/writePack');
    exec = writePack.exec;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exec', () => {
    let action: Action;
    let req: any;

    beforeEach(() => {
      req = {
        body: 'pack data',
      };

      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'https://github.com/finos/git-proxy.git',
      );
      action.proxyGitPath = '/path/to';
      action.repoName = 'repo';
    });

    it('should execute git receive-pack with correct parameters', async () => {
      const dummySpawnOutput = { stdout: 'git receive-pack output', stderr: '', status: 0 };
      spawnSyncMock.mockReturnValue(dummySpawnOutput);

      const result = await exec(req, action);

      expect(spawnSyncMock).toHaveBeenCalledTimes(2);
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        1,
        'git',
        ['config', 'receive.unpackLimit', '0'],
        expect.objectContaining({ cwd: '/path/to/repo' }),
      );
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        2,
        'git',
        ['receive-pack', 'repo'],
        expect.objectContaining({
          cwd: '/path/to',
          input: 'pack data',
        }),
      );

      expect(stepLogSpy).toHaveBeenCalledWith('new idx files: new1.idx');
      expect(stepSetContentSpy).toHaveBeenCalledWith(dummySpawnOutput);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].error).toBe(false);
      expect(result.newIdxFiles).toEqual(['new1.idx']);
    });

    it('should handle errors from git receive-pack', async () => {
      const error = new Error('git error');
      spawnSyncMock.mockImplementation(() => {
        throw error;
      });

      await expect(exec(req, action)).rejects.toThrow('git error');

      expect(stepSetErrorSpy).toHaveBeenCalledOnce();
      expect(stepSetErrorSpy).toHaveBeenCalledWith(expect.stringContaining('git error'));
      expect(action.steps).toHaveLength(1);
      expect(action.steps[0].error).toBe(true);
    });

    it('should always add the step to the action even if error occurs', async () => {
      spawnSyncMock.mockImplementation(() => {
        throw new Error('git error');
      });

      await expect(exec(req, action)).rejects.toThrow('git error');

      expect(action.steps).toHaveLength(1);
    });

    it('should have the correct displayName', () => {
      expect(exec.displayName).toBe('writePack.exec');
    });
  });
});
