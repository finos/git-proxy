const Step = require('../../actions').Step;

const exec = async (req, action) => {
  const step = new Step('authBlock');

  const message =
    '\n\n' +
    `Git Proxy has received your push 🎉\n` +
    '----------------------------------------------------------\n' +
    `   Commit from | ${action.commitFrom}\n` +
    `    Commit to  | ${action.commitTo}\n` +
    `       URL     | http://localhost:8080/requests/${action.id}` +
    '\n\n';
  step.setAsyncBlock(message);
  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
