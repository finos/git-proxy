const exec = (req, result) => {
  if (!req.rawBody) {
    return result;
  }

  const messageParts = req.rawBody.split(' ');
  result.commit = messageParts[0];
  result.commit2 = messageParts[1];
  result.branch = messageParts[2];

  return result;
};

exports.exec = exec;
