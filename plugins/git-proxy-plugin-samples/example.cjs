/**
 * This is a sample plugin that logs a message when the pull action is called. It is written using
 * CommonJS modules to demonstrate the use of CommonJS in plugins.
 */

// Peer dependencies; its expected that these deps exist on Node module path if you've installed @finos/git-proxy
const { PushActionPlugin } = require('@finos/git-proxy/plugin');
const { Step } = require('@finos/git-proxy/proxy/actions');
'use strict';

/**
 * 
 * @param {object} req Express Request object
 * @param {Action} action GitProxy Action
 * @return {Promise<Action>} Promise that resolves to an Action
 */
async function logMessage(req, action) {
  const step = new Step('LogRequestPlugin');
  action.addStep(step);
  console.log(`LogRequestPlugin: req url ${req.url}`);
  console.log(`LogRequestPlugin: req user-agent ${req.header('User-Agent')}`);
  console.log('LogRequestPlugin: action', JSON.stringify(action));
  return action;
}

class LogRequestPlugin extends PushActionPlugin {
  constructor() {
    super(logMessage)
  }
}


module.exports = {
  // Plugins can be written inline as new instances of Push/PullActionPlugin
  // A custom class is not required
  hello: new PushActionPlugin(async (req, action) => {
    const step = new Step('HelloPlugin');
    action.addStep(step);
    console.log('Hello world from the hello plugin!');
    return action;
  }),
  // Sub-classing is fine too if you require more control over the plugin
  logRequest: new LogRequestPlugin(),
  someOtherValue: 'foo', // This key will be ignored by the plugin loader
};