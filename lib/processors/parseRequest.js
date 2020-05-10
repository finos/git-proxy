const exec = (req, result) => {
  // Setup the basics
  result.timestamp = Date.now();

  // We'll use the URL for the moment to figure out the repo name
  result.url = req.originalUrl;
  result.method = req.method;
  result.headers = req.headers;

  // An other result - did this thing work
  result.ok = true;
  result.message = '';

  // processors will log into here each step
  result.actionLog = [];

  return result;
};

exports.exec = exec;
