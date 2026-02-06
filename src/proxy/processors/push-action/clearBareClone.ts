import { Action, Step } from '../../actions';
import fs from 'node:fs/promises';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // Recursively remove the contents of ./.remote and ignore exceptions
  await fs.rm('./.remote', { recursive: true, force: true });
  console.log(`.remote is deleted!`);

  action.addStep(step);
  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
