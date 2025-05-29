import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');
  const user = action.user;

  if (!user) {
    console.log('Action has no user set. This may be due to a fast-forward ref update. Deferring to getMissingData action.');
    return action;
  }

  return await validateUser(user, action, step);
};

/**
 * Helper that validates the user's push permission.
 * This can be used by other actions that need it. For example, when the user is missing from the commit data,
 * validation is deferred to getMissingData, but the logic is the same.
 * @param {string} user The user to validate
 * @param {Action} action The action object
 * @param {Step} step The step object
 * @return {Promise<Action>} The action object
 */
const validateUser = async (user: string, action: Action, step: Step): Promise<Action> => { 
  const repoName = action.repo.split('/')[1].replace('.git', '');
  let isUserAllowed = false;

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

export { exec, validateUser };
