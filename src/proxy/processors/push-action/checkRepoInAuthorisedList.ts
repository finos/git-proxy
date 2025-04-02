import { Action, Step } from '../../actions';
import { getRepos } from '../../../db';
import { Repo } from '../../../db/types';

// Execute if the repo is approved
const exec = async (
  req: any,
  action: Action,
  authorisedList: () => Promise<Repo[]> = getRepos,
): Promise<Action> => {
  const step = new Step('checkRepoInAuthorisedList');

  const list = await authorisedList();
  console.log(list);

  const found = list.find((x: Repo) => {
    const targetName = action.repo.replace('.git', '').toLowerCase();
    const allowedName = `${x.project}/${x.name}`.replace('.git', '').toLowerCase();
    console.log(`${targetName} = ${allowedName}`);
    return targetName === allowedName;
  });

  console.log(found);

  if (!found) {
    console.log('not found');
    step.error = true;
    step.log(`repo ${action.repo} is not in the authorisedList, ending`);
    console.log('setting error');
    step.setError(`Rejecting repo ${action.repo} not in the authorisedList`);
    action.addStep(step);
    return action;
  }

  console.log('found');
  step.log(`repo ${action.repo} is in the authorisedList`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';

export { exec };
