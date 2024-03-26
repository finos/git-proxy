const spawnSync = require('child_process').spawnSync;
const Step = require('../../actions').Step;
const fs = require('fs');
const dir = './.remote';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = async (req, action) => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.timestamp}`;

    step.log(`Creating folder ${action.proxyGitPath}`);

    if (!fs.existsSync(action.proxyGitPath)) {
      fs.mkdirSync(action.proxyGitPath, '0777', true);
    }

    const cmd = `git clone ${action.url} --bare`;

    // Retrieve authorization headers
    const authorizationHeader = req.headers?.authorization;

    // Validate the authorization headers
    const authorizationValid =
      authorizationHeader &&
      typeof authorizationHeader === 'string' &&
      authorizationHeader.includes('Basic ');

    // Construct clone URL depending on presence of authorization headers
    const cloneUrl = authorizationValid
      ? `https://${Buffer.from(authorizationHeader.split(' ')[1], 'base64')}@${action.url.replace(
          /https*:\/\//,
          '',
        )}`
      : action.url;

    step.log(`Exectuting ${cmd}${authorizationValid ? ' with credentials' : ''}`);

    const response = spawnSync('git', ['clone', cloneUrl, '--bare', '--progress'], {
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
