const execSync = require('child_process').execSync;

const exec = (req, result) => {
  const action = {
    action: 'getDiff',
    ok: true,
  };

  if (result.commit != '0000000000000000000000000000000000000000') {
    const path = `${result.proxyGitPath}/${result.repoName}.git`;

    // Get the diff
    const logs = execSync(
        `git diff ${result.commit} ${result.commit2}`, {
          cwd: path,
        },
    ).toString('utf-8');

    console.info(logs);

    action.logs = logs;
  }

  result.actionLog.push(action);

  return result;
};

exec.displayName = 'getDiff.exec';
exports.exec = exec;
