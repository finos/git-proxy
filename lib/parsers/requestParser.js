const exec = (req, result) => {
  result.timesteamp = Date.now();
  result.url = req.originalUrl;
  result.method = req.method;
  result.client = req.headers.agent;

  return result;
};

exports.exec = exec;
