const Step = require('@finos/git-proxy/src/proxy/actions').Step;
const plugin = require('@finos/git-proxy/src/plugin');

const helloPlugin = new plugin.GenericPlugin((req, action) => {
  const step = new Step('helloPlugin');
  console.log('This is a message from the helloPlugin!');
  console.log(`req: ${req}`);
  console.log(`action: ${action}`);
  action.addStep(step);
  return action;
});

module.exports.helloPlugin = helloPlugin;
