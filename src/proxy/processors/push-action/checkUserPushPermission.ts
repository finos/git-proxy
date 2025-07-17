import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';
import { trimTrailingDotGit } from '../../../db/helper';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');

  const repoSplit = trimTrailingDotGit(action.repo.toLowerCase()).split('/');
  // we expect there to be exactly one / separating org/repoName
  if (repoSplit.length != 2) {
    step.setError('Server-side issue extracting repoName');
    action.addStep(step);
    return action;
  }
  // pull the 2nd value of the split for repoName
  const repoName = repoSplit[1];
  let isUserAllowed = false;
  let user = action.user;

  // Find the user associated with this Git Account
  const list = await getUsers({ gitAccount: action.user });

  console.log(`Users for this git account: ${JSON.stringify(list)}`);

  if (list.length == 1) {
    user = list[0].username;
    isUserAllowed = await isUserPushAllowed(repoName, user);
  }

  console.log(`User ${user} permission on Repo ${repoName} : ${isUserAllowed}`);

  if (!isUserAllowed) {
    console.log('User not allowed to Push');
    step.error = true;
    step.log(`User ${user} is not allowed to push on repo ${action.repo}, ending`);

    console.log('setting error');

    step.setError(
      `Rejecting push as user ${action.user} ` +
        `is not allowed to push on repo ` +
        `${action.repo}`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${user} is allowed to push on repo ${action.repo}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec };
