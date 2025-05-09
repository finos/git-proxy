const { PushActionPlugin, PullActionPlugin } = require('@finos/git-proxy/src/plugin');

module.exports = {
  foo: new PushActionPlugin(async (req, action) => {
    console.log('PushActionPlugin: ', action);
    return action;
  }),
  bar: new PullActionPlugin(async (req, action) => {
    console.log('PullActionPlugin: ', action);
    return action;
  }),
};
