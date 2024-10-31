const { PushActionPlugin } = require('@osp0/finos-git-proxy/plugin');

class DummyPlugin extends PushActionPlugin {
  constructor(exec) {
    super();
    this.exec = exec;
  }
}

// test default export
module.exports = new DummyPlugin(async (req, action) => {
  console.log('Dummy plugin: ', action);
  return action;
});
