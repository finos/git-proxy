const exec = (req, result) => {
  // Setup the basics
  result.timesteamp = Date.now();

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
  console.debug(repo);
  result.repo = repo;

  return result;
};

const getRepoNameFromUrl = (url) => {
  const parts = url.split('/');
  console.log(parts);
  console.log('length=' + parts.length);

  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    console.log(part);
    if (part.endsWith('.git')) {
      console.debug(`found ${part}`);
      const repo = `${parts[i -1]}/${part}`;
      console.debug(repo);
      return repo;
    } else {
      console.debug(`ignoring ${part}`);
    }
  };

  return 'NOT-FOUND';
};

exports.exec = exec;
