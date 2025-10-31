import { PushActionPlugin, PullActionPlugin } from '@finos/git-proxy/plugin';

// test multiple exports (ESM syntax)
export default {
  foo: new PushActionPlugin(async (req, action) => {
    console.log('PushActionPlugin: ', action);
    return action;
  }),
  bar: new PullActionPlugin(async (req, action) => {
    console.log('PullActionPlugin: ', action);
    return action;
  }),
};
