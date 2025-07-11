import { Action, Step } from '../../actions';
import { getRepoByUrl } from '../../../db';

// Execute if the repo is approved
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkRepoInAuthorisedList');

  // console.log(found);
  const found = (await getRepoByUrl(action.url)) !== null;

  if (!found) {
    console.log(`Repository url '${action.url}' not found`);
    step.error = true;
    step.log(`repo ${action.url} is not in the authorisedList, ending`);
    console.log('setting error');
    step.setError(`Rejecting repo ${action.url} not in the authorisedList`);
    action.addStep(step);
    return action;
  }

  console.log('found');
  step.log(`repo ${action.url} is in the authorisedList`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';

export { exec };
