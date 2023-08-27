const plugin = require('@finos/git-proxy/src/plugin');

const helloPlugin = new plugin.GenericPlugin((req, action) => {
  console.log('This is a message from the helloPlugin!');
  console.log(`action: ${action}`);

  // this is a hack to satisfy the chain logic
  return {
    continue: () => true,
  };
});

module.exports.helloPlugin = helloPlugin;
