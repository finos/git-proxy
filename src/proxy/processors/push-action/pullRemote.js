const spawnSync = require('child_process').spawnSync;
const Step = require('../../actions').Step;
const fs = require('fs');
const dir = './.remote';

const exec = async (req, action) => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.timestamp}`;

    step.log(`Creating folder ${action.proxyGitPath}`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    if (!fs.existsSync(action.proxyGitPath)) {
      fs.mkdirSync(action.proxyGitPath, '0755', true);
    }

    const cmd = `git clone ${action.url} --bare`;

    step.log(`Exectuting ${cmd}`);

    const response = spawnSync('git', ['clone', action.url, '--bare', '--progress'], {
      cwd: action.proxyGitPath,
      encoding: 'utf-8',
    });

    const cloneOutput = response?.stderr;
    step.log(cloneOutput);

    step.log(`Completed ${cmd}`);
    step.setContent(cloneOutput);
  } catch (e) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';
exports.exec = exec;
