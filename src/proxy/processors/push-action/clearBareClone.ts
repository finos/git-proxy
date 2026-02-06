import { Action, Step } from '../../actions';
import fs from 'fs';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // Recursively remove the contents of ./.remote and ignore exceptions
  if (action.proxyGitPath) {
    fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
    step.log(`.remote is deleted!`);
  } else {
    // This action should not be called unless a clone was made successfully as pullRemote cleans up after itself on failures
    // Log an error as we couldn't delete the clone
    step.setError(`action.proxyGitPath was not set and cannot be removed`);
  }
  action.addStep(step);

  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
