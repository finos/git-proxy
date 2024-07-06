const Step = require('@finos/git-proxy/src/proxy/actions').Step;
// eslint-disable-next-line no-unused-vars
const Action = require('@finos/git-proxy/src/proxy/actions').Action;
const ActionPlugin = require('@finos/git-proxy/src/plugin').ActionPlugin;
'use strict';

class HelloPlugin extends ActionPlugin {
  constructor() {
    super(function logMessage(req, action) {
      const step = new Step('HelloPlugin');
      action.addStep(step);
      console.log('This is a message from the HelloPlugin!');
      return action;
    })
  }
}

/**
 * 
 * @param {Request} req 
 * @param {Action} action 
 * @return {Promise<Action>} Promise that resolves to an Action
 */
async function logMessage(req, action) {
  const step = new Step('LogRequestPlugin');
  action.addStep(step);
  console.log(`LogRequestPlugin: req url ${req.url}`);
  console.log('LogRequestPlugin: action', JSON.stringify(action));
  return action;
}

class LogRequestPlugin extends ActionPlugin {
  constructor() {
    super(logMessage)
  }  

}


module.exports = {
  hello: new HelloPlugin(),
  logRequest: new LogRequestPlugin()
};