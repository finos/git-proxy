const Step = require('../../actions').Step;
const os = require('os');
const hostname = os.hostname();

const exec = async (req, action) => {
  const step = new Step('authBlock');
  step.setAsyncBlock(`Your push request is waiting authorisation, tracking id http://${hostname}:3000/requests/${action.id}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'blockForAuth.exec';
exports.exec = exec;
