const exec = (req, result) => {
  const paths = result.url.split('/');

  if (paths[paths.length -1] == 'git-receive-pack' &&
      req.method == 'POST' &&
      req.headers['content-type'] == 'application/x-git-receive-pack-request') {
    result.action = new PushAction();
  } else {
    result.action = new NoAction();
  }

  return result;
};

/** Class representing a Push. */
class PushAction {
  /**
   * Create a Push Action
   */
  constructor() {
  }
}

/** Class representing a NoAction. */
class NoAction {
  /**
   * Create a Push Action
   */
  constructor() {
  }
}

exports.exec = exec;
exports.PushAction = PushAction;
exports.NoAction = NoAction;

