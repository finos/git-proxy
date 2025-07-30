import { Action, Step } from '../../actions';
import simpleGit from 'simple-git';

import { EMPTY_COMMIT_HASH } from '../constants';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('diff');

  try {
    const path = `${action.proxyGitPath}/${action.repoName}`;
    const git = simpleGit(path);
    // https://stackoverflow.com/questions/40883798/how-to-get-git-diff-of-the-first-commit
    let commitFrom = `4b825dc642cb6eb9a060e54bf8d69288fbee4904`;

    if (!action.commitData || action.commitData.length === 0) {
      step.error = true;
      step.log('No commitData found');
      step.setError('Your push has been blocked because no commit data was found.');
      action.addStep(step);
      return action;
    }

    if (action.commitFrom === EMPTY_COMMIT_HASH) {
      if (action.commitData[0].parent !== EMPTY_COMMIT_HASH) {
        commitFrom = `${action.commitData[action.commitData.length - 1].parent}`;
      }
    } else {
      commitFrom = `${action.commitFrom}`;
    }

    step.log(`Executing "git diff ${commitFrom} ${action.commitTo}" in ${path}`);
    const revisionRange = `${commitFrom}..${action.commitTo}`;
    const diff = await git.diff([revisionRange]);
    step.log(diff);
    step.setContent(diff);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'getDiff.exec';

export { exec };
