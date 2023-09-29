const Step = require('@finos/git-proxy/src/proxy/actions').Step;
const plugin = require('@finos/git-proxy/src/plugin');

const helloPlugin = new plugin.ActionPlugin(async (req, action) => {
  const step = new Step('HelloPlugin');
  console.log('This is a message from the HelloPlugin!');
  action.addStep(step);
  return action;
});

module.exports.helloPlugin = helloPlugin;
