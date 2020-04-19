const config = require('../config.js');

const exec = (req, result) => {
  const action = {
    action: 'checkRepoWhiteList',
    ok: true,
  };

  if (!config.getWhiteList().includes(result.repo)) {
    action.ok = false;
    result.ok = false;
    result.message = `Rejecting repo ${result.repoName} not in the whitelist`;
  }

  result.actionLog.push(action);

  return result;
};

exports.exec = exec;
