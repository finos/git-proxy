const exec = (req, result) => {
  const messageParts = req.rawBody.split(' ');
  console.debug(req.rawBody);
  result.commit = messageParts[0];
  result.commit2 = messageParts[1];
  result.branch = messageParts[2];

  return result;
};

exports.exec = exec;
