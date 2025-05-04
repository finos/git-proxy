import { Action, Step } from '../../actions';
import { validateUser } from './checkUserPushPermission';
import simpleGit from 'simple-git';

const isEmptyBranch = async (action: Action) => {
  const git = simpleGit(`${action.proxyGitPath}/${action.repoName}`);

  if (action.commitFrom === '0'.repeat(40)) {
    try {
      const type = await git.raw(['cat-file', '-t', action.commitTo || '']);
      const known = type.trim() === 'commit';
      if (known) {
        return true;
      }
    } catch (err) {
      console.log(`Commit ${action.commitTo} not found: ${err}`);
    }
  }

  return false;
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('getMissingData');

  try {
    if (!action.commitData) {
      action.commitData = [];
    }

    if (action.commitData.length === 0) {
      if (await isEmptyBranch(action)) {
        step.setError('Push blocked: Empty branch. Please make a commit before pushing a new branch.');
        action.addStep(step);
        step.error = true;
        return action;
      }
      console.log(`commitData not found, fetching missing commits from git...`);
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

      if (action.commitFrom === '0000000000000000000000000000000000000000') {
        action.commitFrom = action.commitData[action.commitData.length - 1].parent;
      }
      const user = action.commitData[action.commitData.length - 1].committer;
      action.user = user;

      return await validateUser(user, action, step);
    }
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'getMissingData.exec';

export { exec };
