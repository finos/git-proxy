import { spawnSync } from 'child_process';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';

import { Action, Step } from '../../actions';
import { getErrorMessage } from '../../../utils/errors';

const sanitizeInput = (_req: Request, action: Action): string => {
  return `${action.commitFrom} ${action.commitTo} ${action.branch} \n`;
};

const exec = async (
  req: Request,
  action: Action,
  hookFilePath: string = './hooks/pre-receive.sh',
): Promise<Action> => {
  const step = new Step('executeExternalPreReceiveHook');
  let stderrTrimmed = '';

  // Pre-receive hooks execute Unix shell scripts, which is not supported on Windows
  if (process.platform === 'win32') {
    step.log('Warning: Pre-receive hooks are not supported on Windows, skipping execution.');
    action.addStep(step);
    return action;
  }

  try {
    const resolvedPath = path.resolve(hookFilePath);
    const hookDir = path.dirname(resolvedPath);

    if (!fs.existsSync(hookDir) || !fs.existsSync(resolvedPath)) {
      step.log('Pre-receive hook not found, skipping execution.');
      action.addStep(step);
      return action;
    }

    const repoPath = `${action.proxyGitPath}/${action.repoName}`;

    step.log(`Executing pre-receive hook from: ${resolvedPath}`);

    const sanitizedInput = sanitizeInput(req, action);

    const hookProcess = spawnSync(resolvedPath, [], {
      input: sanitizedInput,
      encoding: 'utf-8',
      cwd: repoPath,
    });

    const { stdout, stderr, status } = hookProcess;

    stderrTrimmed = stderr ? stderr.trim() : '';
    const stdoutTrimmed = stdout ? stdout.trim() : '';

    step.log(`Hook exited with status ${status}`);

    if (status === 0) {
      step.log('Push automatically approved by pre-receive hook.');
      action.addStep(step);
      action.setAutoApproval();
    } else if (status === 1) {
      step.log('Push automatically rejected by pre-receive hook.');
      action.addStep(step);
      action.setAutoRejection();
    } else if (status === 2) {
      step.log('Push requires manual approval.');
      action.addStep(step);
    } else {
      step.error = true;
      step.log(`Unexpected hook status: ${status}`);
      step.setError(stdoutTrimmed || 'Unknown pre-receive hook error.');
      action.addStep(step);
    }
    return action;
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.error = true;
    step.log('Push failed, pre-receive hook returned an error.');
    step.setError(`Hook execution error: ${stderrTrimmed || msg}`);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'executeExternalPreReceiveHook.exec';

export { exec };
