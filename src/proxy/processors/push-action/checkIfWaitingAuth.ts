import { Action, Step } from '../../actions';
import { getPush } from '../../../db';

// Execute function
const exec = async (req: any, action: Action): Promise<Action> => {
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
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'checkIfWaitingAuth.exec';

export { exec };
