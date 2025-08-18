import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';
import { trimTrailingDotGit } from '../../../db/helper';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');
  const userEmail = action.userEmail;

  if (!userEmail) {
    step.setError('Push blocked: User not found. Please contact an administrator for support.');
    action.addStep(step);
    step.error = true;
    return action;
  }

  return await validateUser(userEmail, action, step);
};

/**
 * Helper that validates the user's push permission.
 * This can be used by other actions that need it.
 * @param {string} userEmail The user to validate
 * @param {Action} action The action object
 * @param {Step} step The step object
 * @return {Promise<Action>} The action object
 */
const validateUser = async (userEmail: string, action: Action, step: Step): Promise<Action> => {
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

  // Find the user associated with this email address
  const list = await getUsers({ email: userEmail });

  if (list.length > 1) {
    console.error(`Multiple users found with email address ${userEmail}, ending`);
    step.error = true;
    step.log(
      `Multiple Users have email <${userEmail}> so we cannot uniquely identify the user, ending`,
    );

    step.setError(
      `Your push has been blocked (there are multiple users with email ${action.userEmail})`,
    );
    action.addStep(step);
    return action;
  } else if (list.length == 0) {
    console.error(`No user with email address ${userEmail} found`);
  } else {
    isUserAllowed = await isUserPushAllowed(repoName, list[0].username);
  }

  console.log(`User ${userEmail} permission on Repo ${repoName} : ${isUserAllowed}`);

  if (!isUserAllowed) {
    console.log('User not allowed to Push');
    step.error = true;
    step.log(`User ${userEmail} is not allowed to push on repo ${action.repo}, ending`);

    step.setError(
      `Your push has been blocked (${action.userEmail} ` +
        `is not allowed to push on repo ` +
        `${action.repo})`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${userEmail} is allowed to push on repo ${action.repo}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec, validateUser };
