import { Action, Step } from '../../actions';
import { validateUser } from './checkUserPushPermission';
import simpleGit from 'simple-git';

import { EMPTY_COMMIT_HASH } from '../constants';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('getMissingData');

  if (action.commitData && action.commitData.length > 0) {
    console.log('getMissingData', action);
    return action;
  }

  console.log(`commitData not found, fetching missing commits from git...`);

  try {
    const path = `${action.proxyGitPath}/${action.repoName}`;
    const git = simpleGit(path);
    const log = await git.log({ from: action.commitFrom, to: action.commitTo });

    action.commitData = log.all.toReversed().map((entry, i, array) => {
      const parent = i === 0 ? action.commitFrom : array[i - 1].hash;
      const timestamp = Math.floor(new Date(entry.date).getTime() / 1000).toString();
      return {
        message: entry.message || '',
        committer: entry.author_name || '',
        tree: entry.hash || '',
        parent: parent || '0'.repeat(40),
        author: entry.author_name || '',
        authorEmail: entry.author_email || '',
        commitTimestamp: timestamp,
      }
    });
    console.log(`Updated commitData:`, { commitData: action.commitData });

    if (action.commitFrom === EMPTY_COMMIT_HASH) {
      action.commitFrom = action.commitData[action.commitData.length - 1].parent;
    }
    const user = action.commitData[action.commitData.length - 1].committer;
    action.user = user;

    return await validateUser(user, action, step);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'getMissingData.exec';

export { exec };
