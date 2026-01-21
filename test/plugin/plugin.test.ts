import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { isCompatiblePlugin, PushActionPlugin, PluginLoader } from '../../src/plugin';

const testPackagePath = join(__dirname, '../fixtures', 'test-package');

describe('loading plugins from packages', () => {
  beforeAll(() => {
    // Use shell: true for cross-platform compatibility (npm.cmd on Windows)
    console.log('=== Plugin test debug info ===');
    console.log('Test package path:', testPackagePath);
    console.log('Platform:', process.platform);

    const result = spawnSync('npm', ['install'], {
      cwd: testPackagePath,
      timeout: 30000,
      shell: true,
      encoding: 'utf-8',
    });

    console.log('npm install exit code:', result.status);
    if (result.stdout) console.log('npm install stdout:', result.stdout);
    if (result.stderr) console.log('npm install stderr:', result.stderr);
    if (result.error) console.log('npm install error:', result.error);

    const nodeModulesPath = join(testPackagePath, 'node_modules');
    console.log('node_modules exists:', existsSync(nodeModulesPath));

    if (existsSync(nodeModulesPath)) {
      console.log('node_modules contents:', readdirSync(nodeModulesPath));
      const finosPath = join(nodeModulesPath, '@finos');
      if (existsSync(finosPath)) {
        console.log('@finos contents:', readdirSync(finosPath));
      }
    }
    console.log('=== End debug info ===');
  });

  describe('CommonJS syntax', () => {
    it(
      'should load plugins that are the default export (module.exports = pluginObj)',
      async () => {
        const loader = new PluginLoader([join(testPackagePath, 'default-export.js')]);
        await loader.load();
        expect(loader.pushPlugins.length).toBe(1);
        expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
        expect(
          loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
        ).toBe(true);
      },
      { timeout: 10000 },
    );

    it(
      'should load multiple plugins from a module that match the plugin class (module.exports = { pluginFoo, pluginBar })',
      async () => {
        const loader = new PluginLoader([join(testPackagePath, 'multiple-export.js')]);
        await loader.load();
        expect(loader.pushPlugins.length).toBe(1);
        expect(loader.pullPlugins.length).toBe(1);
        expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
        expect(
          loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
        ).toBe(true);
        expect(
          loader.pullPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPullActionPlugin')),
        ).toBe(true);
      },
      { timeout: 10000 },
    );

    it(
      'should load plugins that are subclassed from plugin classes',
      async () => {
        const loader = new PluginLoader([join(testPackagePath, 'subclass.js')]);
        await loader.load();
        expect(loader.pushPlugins.length).toBe(1);
        expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
        expect(
          loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
        ).toBe(true);
      },
      { timeout: 10000 },
    );
  });

  describe('ESM syntax', () => {
    it(
      'should load plugins that are the default export (exports default pluginObj)',
      async () => {
        const loader = new PluginLoader([join(testPackagePath, 'esm-export.js')]);
        await loader.load();
        expect(loader.pushPlugins.length).toBe(1);
        expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
        expect(
          loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
        ).toBe(true);
      },
      { timeout: 10000 },
    );
    it('should load multiple plugins from a module that match the plugin class (exports default { pluginFoo, pluginBar })', async () => {
      const loader = new PluginLoader([join(testPackagePath, 'esm-multiple-export.js')]);
      await loader.load();
      expect(loader.pushPlugins.length).toBe(1);
      expect(loader.pullPlugins.length).toBe(1);
      expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
      expect(
        loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
      ).toBe(true);
      expect(
        loader.pullPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPullActionPlugin')),
      ).toBe(true);
    });
    it('should load plugins that are subclassed from plugin classes (exports default class DummyPlugin extends PushActionPlugin {})', async () => {
      const loader = new PluginLoader([join(testPackagePath, 'esm-subclass.js')]);
      await loader.load();
      expect(loader.pushPlugins.length).toBe(1);
      expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
      expect(
        loader.pushPlugins.every((p) => isCompatiblePlugin(p, 'isGitProxyPushActionPlugin')),
      ).toBe(true);
    });
  });

  it(
    'should not load plugins that are not valid modules',
    async () => {
      const loader = new PluginLoader([join(__dirname, './dummy.js')]);
      await loader.load();
      expect(loader.pushPlugins.length).toBe(0);
      expect(loader.pullPlugins.length).toBe(0);
    },
    { timeout: 10000 },
  );

  it(
    'should not load plugins that are not extended from plugin objects',
    async () => {
      const loader = new PluginLoader([join(__dirname, './fixtures/baz.js')]);
      await loader.load();
      expect(loader.pushPlugins.length).toBe(0);
      expect(loader.pullPlugins.length).toBe(0);
    },
    { timeout: 10000 },
  );

  afterAll(() => {
    // Use force: true to avoid error if node_modules doesn't exist
    rmSync(join(testPackagePath, 'node_modules'), { recursive: true, force: true });
  });
});

describe('plugin functions', () => {
  it('should return true for isCompatiblePlugin', () => {
    const plugin = new PushActionPlugin(async () => {});
    expect(isCompatiblePlugin(plugin)).toBe(true);
    expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).toBe(true);
  });

  it('should return false for isCompatiblePlugin', () => {
    const plugin = {};
    expect(isCompatiblePlugin(plugin)).toBe(false);
  });

  it('should return true for isCompatiblePlugin with a custom type', () => {
    class CustomPlugin extends PushActionPlugin {
      isCustomPlugin = true;
    }
    const plugin = new CustomPlugin(async () => {});
    expect(isCompatiblePlugin(plugin)).toBe(true);
    expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).toBe(true);
  });
});
