import { Request } from 'express';

import { Action, Step } from '../../actions';
import { getPush } from '../../../db';
import { getErrorMessage } from '../../../utils/errors';

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
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.setError(msg);
    throw error;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'checkIfWaitingAuth.exec';

export { exec };
