const proc = require('./processors');

// Pre Processors are mandatory steps to figure out the incomming action
const preProcessors = [proc.pre.parseAction];

// A NoAction chain is when we are not interested in what's going through
const noActionChain = [];

// A push action chain is when someone tries to push to a remote repo
const pushActionChain = [  
  proc.push.checkRepoInAuthorisedList,
  proc.push.parsePush,
  proc.push.checkIfWaitingAuth,
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.getDiff,
  proc.push.blockForAuth,  
];

// Executes the chain
const chain = (req) => {
  let action;

  // These are mandatory steps - we need to parse the request
  // and figure out the action being taken
  preProcessors.forEach((fn) => {
    console.log(`executing action ${fn.displayName}`);
    action = fn(req, action);
  });

  try {
    // For the action get the liss of processors
    getChain(action).forEach((fn) => {      
      console.log(`executing action ${fn.displayName}`);      
      if (!(action.continue())) {
        return;
      }

      if (action.allowPush) {
        console.log('---- ALLLOWING PUSH!!! -----------')
        return;
      }      
            
      action = fn(req, action);
    });
  } finally {
    proc.push.audit(req, action);
  }

  return action;
};

// Get the chain for the action type
const getChain = (action) => {
  if (action.type === 'pull') return noActionChain;
  if (action.type === 'push') return pushActionChain;
};

exports.exec = chain;
