const exec = (req, result) => {
  console.debug('parsing push request');
  const messageParts = req.rawBody.split(' ');
  result.commit = messageParts[0];
  result.commit2 = messageParts[1];
  result.branch = messageParts[2];

  return result;
};

exports.exec = exec;
