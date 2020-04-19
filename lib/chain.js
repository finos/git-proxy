const proc = require('./processors/index.js');
const actions = require('./actions/index.js');

const preProcessors = [proc.parseRequest, proc.parseAction];

const chain = (req) => {
  let result = { };

  // These are mandatory steps - we need to parse the request
  // and figure out the action being taken
  preProcessors.forEach((fn) => {
    result = fn(req, result);
  });

  // For the action get the liss of processors
  getChain(result).forEach((fn) => {
    result = fn(req, result);

    if (!result.ok) {
      return result;
    }
  });

  return result;
};

const getChain = (result) => {
  if (result.action instanceof actions.NoAction) return [];

  if (result.action instanceof actions.PushAction) {
    return [
      proc.parsePush,
      proc.checkRepoInWhiteList,
    ];
  }
};

exports.exec = chain;
