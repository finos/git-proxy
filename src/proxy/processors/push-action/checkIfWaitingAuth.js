const Step = require('../../actions').Step;
const data = require('../../../db');

const exec = async (req, action) => {
  const step = new Step('checkIfWaitingAuth');
  try {
    const existingAction = await data.getPush(action.id);
    if (existingAction) {
      action = existingAction;
      if (existingAction.authorised) {
        action = existingAction;
        action.setAllowPush();
      }
    }

    action.addStep(step);
    return action;
  } catch (e) {
    step.setError(e.message);
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'checkIfWaitingAuth.exec';
exports.exec = exec;
