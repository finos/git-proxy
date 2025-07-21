import { Action, Step } from '../../actions';
import { getUsers, isUserPushAllowed } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');

  let isUserAllowed = false;
  let user = action.user;

  // Find the user associated with this Git Account
  const list = await getUsers({ gitAccount: action.user });

  console.log(`Users for this git account: ${JSON.stringify(list)}`);

  if (list.length == 1) {
    user = list[0].username;
    isUserAllowed = await isUserPushAllowed(action.url, user!);
  }

  console.log(`User ${user} permission on Repo ${action.url} : ${isUserAllowed}`);

  if (!isUserAllowed) {
    console.log('User not allowed to Push');
    step.error = true;
    step.log(`User ${user} is not allowed to push on repo ${action.url}, ending`);
    step.setError(
      `Rejecting push as user ${action.user} ` +
        `is not allowed to push on repo ` +
        `${action.repo}`,
    );
    action.addStep(step);
    return action;
  }

  step.log(`User ${user} is allowed to push on repo ${action.url}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec };
