import { Action, Step } from '../../actions';
import { getServiceUIURL } from '../../../service/urls';

const exec = async (req: any, action: Action) => {
  const step = new Step('authBlock');
  const url = getServiceUIURL(req);

  const message =
    '\n\n\n' +
    `\x1B[32mGitProxy has received your push ✅\x1B[0m\n\n` +
    '🔗 Shareable Link\n\n' +
    `\x1B[34m${url}/admin/push/${action.id}\x1B[0m` +
    '\n\n\n';
  step.setAsyncBlock(message);

  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';

export { exec };
