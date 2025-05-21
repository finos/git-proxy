import { writeAudit } from '../../../db';
import { Action } from '../../actions';

const exec = async (req: any, action: Action) => {
  if (action.type !== 'pull') {
    await writeAudit(action);
  }

  return action;
};

exec.displayName = 'audit.exec';

export { exec };
