import { Action, Step } from '../../actions';
import fs from 'node:fs';

const WORK_DIR = './.remote/work';

const exec = async (_req: any, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // Delete ONLY this push's working copy
  const workCopy = `${WORK_DIR}/${action.id}`;

  if (fs.existsSync(workCopy)) {
    try {
      fs.rmSync(workCopy, { recursive: true, force: true });
      step.log(`Cleaned working copy for push ${action.id}`);
    } catch (err) {
      step.log(`Warning: Could not clean working copy ${workCopy}: ${err}`);
    }
  } else {
    step.log(`Working copy ${workCopy} not found (may have been already cleaned)`);
  }

  // Note: Cache limit enforcement is handled by pullRemote after cloning
  step.log('Working copy cleanup complete');

  action.addStep(step);
  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
