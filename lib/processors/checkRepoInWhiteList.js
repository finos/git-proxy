const config = require('../config.js');

const exec = (req, result) => {
  console.debug('checking repo whitelist');

  const action = {
    action: 'checkRepoWhiteList',
    ok: true,
  };

  const whiteList = config.getWhiteList();
  console.log(`whiteList ${whiteList}`);
  console.log(`repoName=${result.repo}`);

  if (!whiteList.includes(result.repo)) {
    action.ok = false;
    result.ok = false;
    result.message = `Rejecting repo ${result.repoName} not in the whitelist`;
  }

  result.actionLog.push(action);

  return result;
};

exports.exec = exec;
