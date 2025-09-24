import { writeAudit } from '../../../db';
import { Action, RequestType } from '../../actions';

const exec = async (req: any, action: Action) => {
  if (action.type !== RequestType.PULL) {
    await writeAudit(action);
  }

  return action;
};

exec.displayName = 'audit.exec';

export { exec };
