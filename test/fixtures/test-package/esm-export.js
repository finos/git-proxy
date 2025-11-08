import { PushActionPlugin } from '@finos/git-proxy/plugin';

// test default export (ESM syntax)
export default new PushActionPlugin(async (req, action) => {
  console.log('Dummy plugin: ', action);
  return action;
});
