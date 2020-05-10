const proc = require('./processors/index.js');
const actions = require('./actions/index.js');

// Pre Processors are mandatory steps to figure out the incomming action
const preProcessors = [proc.parseRequest, proc.parseRepo, proc.parseAction];

// A NoAction chain is when we are not interested in what's going through
const noActionChain = [proc.audit];

// A push action chain is when someone tries to push to a remote repo
const pushActionChain = [
  proc.checkRepoInWhiteList,
  proc.parsePush,
  proc.pullRemote,
  proc.writePack,
  proc.getDiff,
];

// Executes the chain
const chain = (req) => {
  let result = { };

  // These are mandatory steps - we need to parse the request
  // and figure out the action being taken
  preProcessors.forEach((fn) => {
    console.log(`executing action ${fn.name}`);
    result = fn(req, result);
  });

  try {
    // For the action get the liss of processors
    getChain(result).forEach((fn) => {
      result = fn(req, result);
      if (!result.ok) {
        return result;
      }
    });
  } finally {
    result = proc.audit(req, result);
  }

  return result;
};

// Get the chain for the action type
const getChain = (result) => {
  if (result.action instanceof actions.NoAction) return noActionChain;
  if (result.action instanceof actions.PushAction) return pushActionChain;
};

exports.exec = chain;
