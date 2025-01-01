/**
 * This is a sample plugin that logs a message when the pull action is called. It is written using
 * ES modules to demonstrate the use of ESM in plugins.
 */

// Peer dependencies; its expected that these deps exist on Node module path if you've installed @finos/git-proxy
import { PullActionPlugin } from "@finos/git-proxy/src/plugin.js";
import { Step } from "@finos/git-proxy/src/proxy/actions/index.js";

class RunOnPullPlugin extends PullActionPlugin {
  constructor() {
    super(function logMessage(req, action) {
      const step = new Step('RunOnPullPlugin');
      action.addStep(step);
      console.log('RunOnPullPlugin: Received fetch request', req.url);
      return action;
    })
  }
}

// Default exports are supported and will be loaded by the plugin loader
export default new RunOnPullPlugin();
