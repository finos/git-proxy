import { Action, Step } from '../../actions';
import { getRepoByUrl, getUsers } from '../../../db';

const getPushUser = async (action: Action): Promise<string | null> => {
  const list = await getUsers({ gitAccount: action.user });
  return list.length === 1 ? list[0].username : null;
};

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkUserPushPermission');

  const repo = await getRepoByUrl(action.url);
  if (repo) {
    const user = await getPushUser(action);
    const isUserAllowed =
      user && (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user));
    if (isUserAllowed) {
      step.log(`User ${user} is allowed to push on repo ${action.url}`);
    } else {
      step.error = true;
      step.log(`User ${user} is not allowed to push on repo ${action.url}, ending`);
      step.setError(
        `Rejecting push as user ${action.user} is not allowed to push on repo ${action.url}`,
      );
    }
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'checkUserPushPermission.exec';

export { exec };
