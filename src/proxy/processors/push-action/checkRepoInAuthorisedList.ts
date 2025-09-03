import { Action, Step } from '../../actions';
import { getRepoByUrl } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkRepoInAuthorisedList');

  const found = (await getRepoByUrl(action.url)) !== null;
  if (found) {
    step.log(`repo ${action.url} is in the authorisedList`);
  } else {
    step.error = true;
    step.log(`repo ${action.url} is not in the authorised whitelist, ending`);
    step.setError(`Rejecting repo ${action.url} not in the authorised whitelist`);
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';

export { exec };
