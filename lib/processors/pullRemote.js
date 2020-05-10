const execSync = require('child_process').execSync;
const fs = require('fs');
const dir = './.remote';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = (req, result) => {
  const action = {
    action: 'pullRemote',
    ok: true,
  };

  result.proxyGitPath = `${dir}/${result.timestamp}`;

  if (!fs.existsSync(result.proxyGitPath)) {
    fs.mkdirSync(result.proxyGitPath, '0777', true);
  }

  // clone the repo into the working director
  const logs = execSync(
      `git clone ${result.repoFullUrl} --bare`, {cwd: result.proxyGitPath});

  console.log(`logs = ${logs}`);

  action.logs = logs.toString('utf-8');
  result.actionLog.push(action);
  result.ok = true;

  return result;
};

exports.exec = exec;
