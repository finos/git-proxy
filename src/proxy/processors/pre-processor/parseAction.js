const actions = require('../../actions');
const config = require('../../../config');
const { Repo } = require('../../../model');

const exec = async (req) => {
  const id = Date.now();
  const timestamp = id;
  const repo = getRepoFromUrlPath(req.originalUrl);
  const paths = req.originalUrl.split('/');

  let type = 'default';

  if (paths[paths.length - 1].endsWith('git-upload-pack') && req.method == 'GET') {
    type = 'pull';
  }
  if (
    paths[paths.length - 1] == 'git-receive-pack' &&
    req.method == 'POST' &&
    req.headers['content-type'] == 'application/x-git-receive-pack-request'
  ) {
    type = 'push';
  }
  return new actions.Action(id, type, req.method, timestamp, repo);
};

// Get repo from URL path
const getRepoFromUrlPath = (urlPath) => {
  const urlPathSegments = urlPath.split('/');
  const proxyPath = [ urlPathSegments[0], urlPathSegments[1]].join('/');
  for (const proxyConfig of config.getProxyConfigList()) {
    if (proxyConfig.path == proxyPath) {
      // replace '/proxyPath' -> 'proxyUrl' from proxy config
      urlPathSegments.shift(); // remove first '/' item
      urlPathSegments[0] = proxyConfig.url; // replace proxy path with proxy url
      // build repo url without git path
      const repoUrlSegments = [];
      for (const urlPathSegment of urlPathSegments) {
        repoUrlSegments.push(urlPathSegment);
        // eslint-disable-next-line no-useless-escape
        if (urlPathSegment.match(/[a-zA-Z0-9\-]+\.git/)) {
          break;
        }
      }
      const repoUrl = repoUrlSegments.join('/');
      return new Repo(repoUrl); 
    }
  }
  return 'NOT-FOUND';
};

exec.displayName = 'parseAction.exec';
exports.exec = exec;
exports.getRepoFromUrlPath = getRepoFromUrlPath;
