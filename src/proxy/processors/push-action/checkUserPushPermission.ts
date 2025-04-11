import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');

  const repoName = action.repo.split('/')[1].replace('.git', '');
  let isUserAllowed = false;

  // n.b. action.user will be set to whatever the user had set in their user.name config in their git client.
  // it is not necessarily the GitHub username. GitHub looks users by email address as should we
  const userEmail = action.userEmail;
  let username = "unknown";

  // Find the user associated with this email address
  const list = await getUsers({ email: action.userEmail });

  if (list.length > 1) {
    console.warn(`Multiple users found with email address ${userEmail}, using the first only`);
  } else if (list.length == 0){ 
    console.error(`No user with email address ${userEmail} found`);
  } else {
    username = list[0].username
    isUserAllowed = await isUserPushAllowed(repoName, username);
  }

  console.log(`User ${username} <${userEmail}> permission on Repo ${repoName} : ${isUserAllowed}`);

  if (!isUserAllowed) {
    console.log('User not allowed to Push');
    step.error = true;
    step.log(`User ${username} <${userEmail}> is not allowed to push on repo ${action.repo}, ending`);

    console.log('setting error');

    step.setError(
      `Rejecting push as user ${action.user} ` +
      `is not allowed to push on repo ` +
      `${action.repo}`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${username} <${userEmail}> is allowed to push on repo ${action.repo}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec };
