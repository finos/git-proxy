const Step = require('@finos/git-proxy/src/proxy/actions').Step;
const plugin = require('@finos/git-proxy/src/plugin');
const logger = require('/src/logs/logger');

const helloPlugin = new plugin.ActionPlugin(async (req, action) => {
  const step = new Step('HelloPlugin');
  logger.info('This is a message from the HelloPlugin!');
  action.addStep(step);
  return action;
});

module.exports.helloPlugin = helloPlugin;
