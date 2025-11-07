import { PushActionPlugin } from '@finos/git-proxy/plugin';

class DummyPlugin extends PushActionPlugin {
  constructor(exec) {
    super();
    this.exec = exec;
  }
}

// test default export (ESM syntax)
export default new DummyPlugin(async (req, action) => {
  console.log('Dummy plugin: ', action);
  return action;
});
