import { Request } from 'express';
import simpleGit from 'simple-git';

import { Action, Step } from '../../actions';
import { EMPTY_COMMIT_HASH } from '../constants';

const isEmptyBranch = async (action: Action): Promise<boolean> => {
  if (action.commitFrom === EMPTY_COMMIT_HASH) {
    try {
      const git = simpleGit(`${action.proxyGitPath}/${action.repoName}`);

      const type = await git.raw(['cat-file', '-t', action.commitTo || '']);
      return type.trim() === 'commit';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`Commit ${action.commitTo} not found: ${msg}`);
    }
  }

  return false;
};

const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('checkEmptyBranch');

  if (action.commitData && action.commitData.length > 0) {
    return action;
  }

  if (await isEmptyBranch(action)) {
    step.setError('Push blocked: Empty branch. Please make a commit before pushing a new branch.');
    action.addStep(step);
    step.error = true;
    return action;
  } else {
    step.setError(
      'Push blocked: Commit data not found. Please contact an administrator for support.',
    );
    action.addStep(step);
    step.error = true;
    return action;
  }
};

exec.displayName = 'checkEmptyBranch.exec';

export { exec };
