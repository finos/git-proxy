const execSync = require('child_process').execSync;


const exec = (req, result) => {
  const logs = execSync(
      `git receive-pack ${result.repoName}`, {
        cwd: result.proxyGitPath,
        input: req.body,
      },
  ).toString('utf-8');

  result.actionLog.push({
    action: 'writePack',
    ok: true,
    logs: logs,
  });

  return result;
};

exec.displayName = 'writePack.exec';
exports.exec = exec;
