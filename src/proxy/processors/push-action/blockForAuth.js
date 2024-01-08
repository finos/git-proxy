const Step = require('../../actions').Step;

const exec = async (req, action) => {
  const step = new Step('authBlock');
  step.setAsyncBlock(
    `\n\n\nSuccessfully pushed to Git Proxy: ${req.protocol}://${req.hostname}/admin/push/${action.id}\n\n\n`,
  );
  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
