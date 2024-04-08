const Step = require('../../actions').Step;
const db = require('../../../db');
const { logger } = require('../../../logging/index');

// Execute if the repo is approved
const exec = async (req, action, authorisedList = db.getRepos) => {
  const step = new Step('checkRepoInAuthorisedList');

  const list = await authorisedList();
  logger.info(list);

  const found = list.find((x) => {
    const targetName = action.repo.replace('.git', '');
    const allowedName = `${x.project}/${x.name}`.replace('.git', '');
    logger.info(`${targetName} = ${allowedName}`);
    return targetName === allowedName;
  });

  logger.info(found);

  if (!found) {
    logger.info('not found');
    step.error = true;

    step.log(`repo ${action.repo} is not in the authorisedList, ending`);
    step.setError(`Rejecting repo ${action.repo} not in the authorisedList`);
    action.addStep(step);

    return action;
  }

  logger.info('found');
  step.log(`repo ${action.repo} is in the authorisedList`);

  action.addStep(step);
  return action;
};

exec.displayName = 'checkRepoInAuthorisedList.exec';
exports.exec = exec;
