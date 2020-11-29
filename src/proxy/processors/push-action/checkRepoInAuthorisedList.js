const Step = require('../../actions').Step;
const db = require('../../../db');

const exec = async (req, action, authorisedList=db.getAuthorisedList) => {
  const step = new Step('checkRepoInAuthorisedList');

  if (!authorisedList().find((x) => `${x.project}/${x.name}` == action.repo)) {
    step.error = true;
    step.log(`repo ${action.repo} is not in the authorisedList, ending`);
    step.setError(
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
