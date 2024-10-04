const chai = require('chai');
const {
  createLoader,
  isCompatiblePlugin,
  PullActionPlugin,
  PushActionPlugin,
} = require('../src/plugin');
const { spawnSync } = require('child_process');
const { rmSync } = require('fs');
const { join } = require('path');

chai.should();

const expect = chai.expect;

const testPackagePath = join(__dirname, 'fixtures', 'test-package');

describe('creating a new PluginLoader and loading plugins', function () {
  // eslint-disable-next-line no-invalid-this
  this.timeout(10000);

  before(function () {
    spawnSync('npm', ['install'], { cwd: testPackagePath, timeout: 5000 });
  });

  it('should load plugins that are the default export (module.exports = pluginObj)', async function () {
    const loader = await createLoader([join(testPackagePath, 'default-export.js')]);
    await loader.load;
    await loader.ready;
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every(p => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins[0])
      .to.be.an.instanceOf(PushActionPlugin);
  }).timeout(10000);

  it('should load multiple plugins from a module that match the plugin class (module.exports = { pluginFoo, pluginBar })', async function () {
    const loader = await createLoader([join(testPackagePath, 'multiple-export.js')]);
    await loader.load;
    await loader.ready;
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pullPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every(p => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins.every(p => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin'))).to.be.true;
    expect(loader.pullPlugins.every(p => isCompatiblePlugin(p, 'isGitProxyPullActionPlugin'))).to.be.true;
    expect(loader.pushPlugins[0]).to.be.instanceOf(PushActionPlugin);
    expect(loader.pullPlugins[0]).to.be.instanceOf(PullActionPlugin);
  }).timeout(10000);

  it('should load plugins that are subclassed from plugin classes', async function () {
    const loader = await createLoader([join(testPackagePath, 'subclass.js')]);
    await loader.load;
    await loader.ready;
    expect(loader.pushPlugins.length).to.equal(1);
    expect(loader.pushPlugins.every(p => isCompatiblePlugin(p))).to.be.true;
    expect(loader.pushPlugins.every(p => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin'))).to.be.true;
    expect(loader.pushPlugins[0]).to.be.instanceOf(PushActionPlugin);
  }).timeout(10000);

  it('should not load plugins that are not valid modules', async function () {
    const loader = await createLoader([join(__dirname, './dummy.js')]);
    await loader.load;
    await loader.ready;
    expect(loader.pushPlugins.length).to.equal(0);
    expect(loader.pullPlugins.length).to.equal(0);
  }).timeout(10000);

  it('should not load plugins that are not extended from plugin objects', async function () {
    const loader = await createLoader([join(__dirname, './baz.js')]);
    await loader.load;
    await loader.ready;
    expect(loader.pushPlugins.length).to.equal(0);
    expect(loader.pullPlugins.length).to.equal(0);
  }).timeout(10000);

  after(function () {
    rmSync(join(testPackagePath, 'node_modules'), { recursive: true });
  });
});
