const config = require('../config.js');

const exec = (req, result, whiteList=config.getWhiteList) => {
  const action = {
    action: 'checkRepoWhiteList',
    ok: true,
  };

  if (!whiteList().includes(result.repo)) {
    action.ok = false;
    result.ok = false;
    result.message = `Rejecting repo ${result.repoName} not in the whitelist`;
  }

  result.actionLog.push(action);

  return result;
};

exports.exec = exec;
