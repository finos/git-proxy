const proc = require('./processors');

// A push action chain is when someone tries to push to a remote repo
const pushActionChain = [    
  proc.push.parsePush,  
  proc.push.checkRepoInAuthorisedList,  
  proc.push.checkIfWaitingAuth,  
  proc.push.pullRemote,
  proc.push.writePack,
  proc.push.getDiff,
  proc.push.blockForAuth,  
];

// Executes the chain
const chain = async (req) => {
  let action;
  try {
    action = await proc.pre.parseAction(req);
        
    const actions = getChain(action);
    
    for (const i in actions) {
      const fn = actions[i];

      console.log(`executing action ${fn.displayName}`);            
      action = await fn(req, action);      
      console.log(`executed ${fn.displayName}`);      
          
      if (!(action.continue())) {
        console.log(`do not continue`);      
        return action;
      }

      if (action.allowPush) {
        console.log('---- ALLLOWING PUSH!!! -----------')
        return action;
      }          
    }    
  } catch(e){
    console.error(e || e.stackTrace);
  } finally {
    await proc.push.audit(req, action);
  }

  return action;
};

// Get the chain for the action type
const getChain = (action) => {
  if (action.type === 'pull') return [];
  if (action.type === 'push') return pushActionChain;
};

exports.exec = chain;
