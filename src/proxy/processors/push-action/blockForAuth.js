const Step = require('../../actions').Step;

const exec = async (req, action) => {
  const step = new Step('authBlock');
  step.setAsyncBlock(
    `Your push request is waiting authorisation, tracking id http://localhost:8080/requests/${action.id}`,
  );
  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
