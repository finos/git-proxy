const config = require('../../../config');
const Step = require('../../actions').Step;

const exec = async (req, action, authorisedList=config.getAuthorisedList) => {
  const step = new Step('checkRepoInAuthorisedList');

  if (!authorisedList().includes(action.repo)) {
    step.error = true;
    step.log(`repo ${action.repo} is not in the authorisedList, ending`);
    step.setError(
        true,
        `Rejecting repo ${action.repo} not in the authorisedList`,
    );
  } else {
    step.log(`repo ${action.repo} is in the authorisedList`);
  }
  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';
exports.exec = exec;
