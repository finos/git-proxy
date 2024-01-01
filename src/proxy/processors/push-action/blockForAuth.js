const Step = require('../../actions').Step;

const uiPort = process.env.GIT_PROXY_UI_PORT || 8080;

const exec = async (req, action) => {
  const step = new Step('authBlock');

  const message =
    '\n\n\n' +
    `Git Proxy has received your push:\n\n` +
    `http://localhost:${uiPort}/requests/${action.id}` +
    '\n\n\n';
  step.setAsyncBlock(message);
  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
