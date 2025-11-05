const { PushActionPlugin, PullActionPlugin } = require('@finos/git-proxy/plugin');

module.exports = {
  foo: new PushActionPlugin(async (req, action) => {
    console.log('PushActionPlugin: ', action);
    return action;
  }),
  bar: new PullActionPlugin(async (req, action) => {
    console.log('PullActionPlugin: ', action);
    return action;
  }),
  baz: {
    exec: async (req, action) => {
      console.log('not a real plugin object');
    },
  },
};
