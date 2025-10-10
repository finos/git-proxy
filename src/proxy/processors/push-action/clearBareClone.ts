import { Action, Step } from '../../actions';
import fs from 'node:fs';

const WORK_DIR = './.remote/work';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('clearBareClone');

  // In test environment, clean up EVERYTHING to prevent memory leaks
  if (process.env.NODE_ENV === 'test') {
    // TEST: Full cleanup (bare cache + all working copies)
    try {
      if (fs.existsSync('./.remote')) {
        fs.rmSync('./.remote', { recursive: true, force: true });
        step.log('Test environment: Full .remote directory cleaned');
      } else {
        step.log('Test environment: .remote directory already clean');
      }
    } catch (err) {
      step.log(`Warning: Could not clean .remote directory: ${err}`);
    }
  } else {
    // PRODUCTION: Delete ONLY this push's working copy
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

    step.log('Bare cache preserved for reuse');
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'clearBareClone.exec';

export { exec };
