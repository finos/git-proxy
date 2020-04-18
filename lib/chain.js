const parsers = require('./parsers/index.js');

const preProcessors = [parsers.parseRequest, parsers.parseAction];

const chain = (req) => {
  let result = { };

  preProcessors.forEach((fn) => {
    result = fn(req, result);
  });

  getChain(result).forEach((fn) => {
    result = fn(req, result);
  });

  return result;
};

const getChain = (result) => {
  if (result.action instanceof parsers.NoAction) return [];
  if (result.action instanceof parsers.PushAction) return [parsers.parsePush];
};


exports.exec = chain;
