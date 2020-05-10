const execSync = require('child_process').execSync;


const exec = (req, result) => {
  const action = {
    action: 'writePack',
    ok: true,
  };

  // clone the repo into the working director
  const logs = execSync(
      `git receive-pack ${result.repoName}`, {
        cwd: result.proxyGitPath,
        input: req.body,
      },
  ).toString('utf-8');

  console.info(logs);

  action.logs = logs;

  result.actionLog.push(action);

  return result;
};

exports.exec = exec;
