const actions = require('../../actions');

const exec = (req) => {
  
  const id = Date.now();
  const timestamp = id;
  const repoName = getRepoNameFromUrl(req.originalUrl);
  const paths = req.originalUrl.split('/');
  
  let type = 'pull';

  if (paths[paths.length -1] == 'git-receive-pack' 
      && req.method == 'POST' 
      && req.headers['content-type'] == 'application/x-git-receive-pack-request') {    
    type = 'push';
  }

  return new actions.Action(id, type, req.method, timestamp, repoName);  
};


const getRepoNameFromUrl = (url) => {
  console.log(url);
  const parts = url.split('/');

  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    if (part.endsWith('.git')) {
      const repo = `${parts[i -1]}/${part}`;
      return repo.trim();
    }
  };
  return 'NOT-FOUND';
};

exec.displayName = 'parseAction.exec';
exports.exec = exec;
