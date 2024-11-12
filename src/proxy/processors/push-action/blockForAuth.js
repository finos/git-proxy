const { getServiceUIURL } = require('../../../service/urls');

const Step = require('../../actions').Step;

const exec = async (req, action) => {
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
exports.exec = exec;
