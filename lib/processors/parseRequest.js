const exec = (req, result) => {
  // Setup the basics
  result.timestamp = Date.now();

  // We'll use the URL for the moment to figure out the repo name
  result.url = req.originalUrl;
  result.method = req.method;
  result.client = req.headers.agent;

  // An other result - did this thing work
  result.ok = true;
  result.message = '';

  // processors will log into here each step
  result.actionLog = [];

  const repo = getRepoNameFromUrl(result.url);
  result.repo = repo;

  return result;
};

const getRepoNameFromUrl = (url) => {
  const parts = url.split('/');

  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    if (part.endsWith('.git')) {
      const repo = `${parts[i -1]}/${part}`;
      return repo;
    }
  };
  return 'NOT-FOUND';
};

exports.exec = exec;
