const originalEnv = process.env;
const chai = require('chai');
const plugin = require('../src/plugin');

chai.should();

const expect = chai.expect;

describe('creating a new PluginLoader and loading plugins', function () {
  before(function () {
    process.env.GITPROXY_PLUGIN_FILES = './packages/git-proxy-notify-hello/index.js';
  });

  it('should load file-based plugins when set from env var', async function () {
    plugin.createLoader().then((loader) => {
      expect(loader.paths).to.eql(['./packages/git-proxy-notify-hello/index.js']);
      expect(loader.names).to.be.empty;
      expect(loader.plugins.length).to.equal(1);
      expect(loader.plugins[0])
        .to.be.an.instanceOf(plugin.ProxyPlugin)
        .and.to.be.an.instanceOf(plugin.ActionPlugin);
    });
  });

  after(function () {
    // prevent potential side-effects in other tests
    process.env = originalEnv;
  });
});
