const actions = require('../actions/index.js');

const exec = (req, result) => {
  const paths = result.url.split('/');

  if (paths[paths.length -1] == 'git-receive-pack' &&
      req.method == 'POST' &&
      req.headers['content-type'] == 'application/x-git-receive-pack-request') {
    result.action = new actions.PushAction();
  } else {
    result.action = new actions.NoAction();
  }

  return result;
};

exec.displayName = 'parseAction.exec';
exports.exec = exec;
