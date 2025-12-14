import { Request } from 'express';

import { Action, Step } from '../../actions';
import { getPush } from '../../../db';

// Execute function
const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('checkIfWaitingAuth');
  try {
    const existingAction = await getPush(action.id);
    if (existingAction) {
      if (!action.error) {
        if (existingAction.authorised) {
          action = existingAction;
          action.setAllowPush();
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    step.setError(msg);
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'checkIfWaitingAuth.exec';

export { exec };
