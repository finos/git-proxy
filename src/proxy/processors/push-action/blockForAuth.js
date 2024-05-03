const Step = require('../../actions').Step;

const { GIT_PROXY_UI_PORT: uiPort } = require('../../../config/env').Vars;

const exec = async (req, action) => {
  const step = new Step('authBlock');

  const message =
    '\n\n\n' +
    `\x1B[32mGit Proxy has received your push ✅\x1B[0m\n\n` +
    '🔗 Shareable Link\n\n' +
    `\x1B[34mhttp://localhost:${uiPort}/admin/push/${action.id}\x1B[0m` +
    '\n\n\n';
  step.setAsyncBlock(message);

  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
