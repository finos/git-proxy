const { PushActionPlugin } = require('@finos/git-proxy/src/plugin');

// test default export
module.exports = new PushActionPlugin(async (req, action) => {
  console.log('Dummy plugin: ', action);
  return action;
});
