const Step = require('../../actions').Step;
const fs = require('fs');
const dir = './.remote';
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

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

    const cmd = `git clone ${action.url}`;
    step.log(`Exectuting ${cmd}`);

    const authHeader = req.headers?.authorization;
    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
      .toString()
      .split(':');

    await git
      .clone({
        fs,
        http,
        url: action.url,
        onAuth: () => {
          return {
            username: username,
            password: password,
          };
        },
        dir: `${action.proxyGitPath}/${action.repoName}`,
      })
      .then(() => {
        console.log('Clone Success: ', action.url);
      });

    step.log(`Completed ${cmd}`);
    step.setContent(`Completed ${cmd}`);
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
