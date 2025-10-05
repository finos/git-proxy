import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';
import {
  isCompatiblePlugin,
  PullActionPlugin,
  PushActionPlugin,
  PluginLoader,
} from '../../src/plugin';

const testPackagePath = join(__dirname, '../fixtures', 'test-package');

// Temporarily skipping these until plugin loading is refactored to use ESM/TS
describe.skip('loading plugins from packages', { timeout: 10000 }, () => {
  beforeAll(() => {
    spawnSync('npm', ['install'], { cwd: testPackagePath, timeout: 5000 });
  });

  it(
    'should load plugins that are the default export (module.exports = pluginObj)',
    async () => {
      const loader = new PluginLoader([join(testPackagePath, 'default-export.ts')]);
      await loader.load();
      expect(loader.pushPlugins.length).toBe(1);
      expect(loader.pushPlugins.every((p) => isCompatiblePlugin(p))).toBe(true);
      expect(loader.pushPlugins[0]).toBeInstanceOf(PushActionPlugin);
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
      expect(loader.pushPlugins[0]).toBeInstanceOf(PushActionPlugin);
      expect(loader.pullPlugins[0]).toBeInstanceOf(PullActionPlugin);
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
      expect(loader.pushPlugins[0]).toBeInstanceOf(PushActionPlugin);
    },
    { timeout: 10000 },
  );

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
    rmSync(join(testPackagePath, 'node_modules'), { recursive: true });
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
