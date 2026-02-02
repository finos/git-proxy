import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import * as fs from 'fs';
import { exec } from '../../src/proxy/processors/push-action/preReceive';

// TODO: Replace with memfs to prevent test pollution issues
vi.mock('fs', { spy: true });

describe('Pre-Receive Hook Execution', () => {
  let action: any;
  let req: any;

  beforeEach(() => {
    req = {};
    action = {
      steps: [] as any[],
      commitFrom: 'oldCommitHash',
      commitTo: 'newCommitHash',
      branch: 'feature-branch',
      proxyGitPath: 'test/preReceive/mock/repo',
      repoName: 'test-repo',
      addStep(step: any) {
        this.steps.push(step);
      },
      setAutoApproval: vi.fn(),
      setAutoRejection: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should catch and handle unexpected errors', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-0.sh');

    vi.mocked(fs.existsSync).mockImplementationOnce(() => {
      throw new Error('Unexpected FS error');
    });

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(true);
    expect(
      result.steps[0].logs.some((log: string) =>
        log.includes('Hook execution error: Unexpected FS error'),
      ),
    ).toBe(true);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });

  it('should skip execution when hook file does not exist', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/missing-hook.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(false);
    expect(
      result.steps[0].logs.some((log: string) =>
        log.includes('Pre-receive hook not found, skipping execution.'),
      ),
    ).toBe(true);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });

  it('should skip execution when hook directory does not exist', async () => {
    const scriptPath = path.resolve(__dirname, 'non-existent-directory/pre-receive.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(false);
    expect(
      result.steps[0].logs.some((log: string) =>
        log.includes('Pre-receive hook not found, skipping execution.'),
      ),
    ).toBe(true);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });

  it('should approve push automatically when hook returns status 0', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-0.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(false);
    expect(
      result.steps[0].logs.some((log: string) =>
        log.includes('Push automatically approved by pre-receive hook.'),
      ),
    ).toBe(true);
    expect(action.setAutoApproval).toHaveBeenCalledTimes(1);
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });

  it('should reject push automatically when hook returns status 1', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-1.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(false);
    expect(
      result.steps[0].logs.some((log: string) =>
        log.includes('Push automatically rejected by pre-receive hook.'),
      ),
    ).toBe(true);
    expect(action.setAutoRejection).toHaveBeenCalledTimes(1);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
  });

  it('should execute hook successfully and require manual approval', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-2.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(false);
    expect(
      result.steps[0].logs.some((log: string) => log.includes('Push requires manual approval.')),
    ).toBe(true);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });

  it('should handle unexpected hook status codes', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-99.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe(true);
    expect(
      result.steps[0].logs.some((log: string) => log.includes('Unexpected hook status: 99')),
    ).toBe(true);
    expect(
      result.steps[0].logs.some((log: string) => log.includes('Unknown pre-receive hook error.')),
    ).toBe(true);
    expect(action.setAutoApproval).not.toHaveBeenCalled();
    expect(action.setAutoRejection).not.toHaveBeenCalled();
  });
});
