import { Request } from 'express';
import fs from 'node:fs/promises';

import { Action, Step } from '../../actions';

const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // Recursively remove the contents of ./.remote and ignore exceptions
  await fs.rm('./.remote', { recursive: true, force: true });
  console.log(`.remote is deleted!`);

  action.addStep(step);
  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
