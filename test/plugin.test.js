const chai = require('chai');
const {
  isCompatiblePlugin,
  PullActionPlugin,
  PushActionPlugin,
  PluginLoader,
} = require('../src/plugin');
const { spawnSync } = require('child_process');
const { rmSync } = require('fs');
const { join } = require('path');

chai.should();

const expect = chai.expect;

const testPackagePath = join(__dirname, 'fixtures', 'test-package');

describe('loading plugins from packages', function () {
  // eslint-disable-next-line no-invalid-this
  this.timeout(10000);

  before(function () {
    spawnSync('npm', ['install'], { cwd: testPackagePath, timeout: 5000 });
  });

  it('should load plugins that are the default export (module.exports = pluginObj)', async function () {
    const loader = new PluginLoader([join(testPackagePath, 'default-export.js')]);
    await loader.load();
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins[0]).to.be.an.instanceOf(PushActionPlugin);
  }).timeout(10000);

  it('should load multiple plugins from a module that match the plugin class (module.exports = { pluginFoo, pluginBar })', async function () {
    const loader = new PluginLoader([join(testPackagePath, 'multiple-export.js')]);
    await loader.load();
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pullPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin'))).to
      .be.true;
    expect(loader.pullPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPullActionPlugin'))).to
      .be.true;
    expect(loader.pushPlugins[0]).to.be.instanceOf(PushActionPlugin);
    expect(loader.pullPlugins[0]).to.be.instanceOf(PullActionPlugin);
  }).timeout(10000);

  it('should load plugins that are subclassed from plugin classes', async function () {
    const loader = new PluginLoader([join(testPackagePath, 'subclass.js')]);
    await loader.load();
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin'))).to
      .be.true;
    expect(loader.pushPlugins[0]).to.be.instanceOf(PushActionPlugin);
  }).timeout(10000);

  it('should not load plugins that are not valid modules', async function () {
    const loader = new PluginLoader([join(__dirname, './dummy.js')]);
    await loader.load();
    expect(loader.pushPlugins.length).to.equal(0);
    expect(loader.pullPlugins.length).to.equal(0);
  }).timeout(10000);

  it('should not load plugins that are not extended from plugin objects', async function () {
    const loader = new PluginLoader([join(__dirname, './fixtures/baz.js')]);
    await loader.load();
    expect(loader.pushPlugins.length).to.equal(0);
    expect(loader.pullPlugins.length).to.equal(0);
  }).timeout(10000);

  after(function () {
    rmSync(join(testPackagePath, 'node_modules'), { recursive: true });
  });
});

describe('plugin functions', function () {
  it('should return true for isCompatiblePlugin', function () {
    const plugin = new PushActionPlugin();
    expect(isCompatiblePlugin(plugin)).to.be.true;
    expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).to.be.true;
  });

  it('should return false for isCompatiblePlugin', function () {
    const plugin = {};
    expect(isCompatiblePlugin(plugin)).to.be.false;
  });

  it('should return true for isCompatiblePlugin with a custom type', function () {
    class CustomPlugin extends PushActionPlugin {
      constructor() {
        super();
        this.isCustomPlugin = true;
      }
    }
    const plugin = new CustomPlugin();
    expect(isCompatiblePlugin(plugin)).to.be.true;
    expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).to.be.true;
  });
});
