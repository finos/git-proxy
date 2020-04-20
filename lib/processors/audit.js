const fs = require('fs');

const dir = './.logs/';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = (req, result) => {
  const data = JSON.stringify(result, null, 2);
  fs.writeFileSync(`${dir}/${result.timestamp}.json`, data);

  const action = {
    action: 'checkRepoInWhiteList',
    ok: true,
  };

  result.actionLog.push(action);

  return result;
};

exports.exec = exec;

