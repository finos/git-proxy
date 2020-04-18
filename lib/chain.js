const parsers = require('./parsers/index.js');

const chain = (req) => {
  const processors = [parsers.parseRequest, parsers.parsePush];
  let result = { };

  processors.forEach((fn) => {
    result = fn(req, result);
  });

  return result;
};

exports.exec = chain;
