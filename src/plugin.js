/* eslint-disable require-jsdoc */
/* eslint-disable guard-for-in */
const path = require('path');
const lpModule = import('load-plugin');
('use strict');

/**
 * Finds, registers and loads plugins used by git-proxy
 */
class PluginManager {
  /**
   * Initialize PluginManager
   * @param {Array.<string>} names List of Node module/package names to load.
   * @param {Array.<string>} paths List of directory paths to load modules from.
   */
  constructor(names, paths) {
    console.log(`Initializing plugin manager...`);
    this.names = names;
    this.paths = paths;
    this.plugins = [];
    this.pluginModules = [];
    this.modulesLoaded = false;
    this.loaded = false;
  }

  /**
   * Load configured plugins as modules and set each concrete ProxyPlugin
   * to this.plugins for use in proxying.
   */
  async loadModules() {
    // load a list of modules from file path or node_modules
    const loadPlugin = (await lpModule).loadPlugin;
    const resolvePlugin = (await lpModule).resolvePlugin;
    if (this.names !== undefined && this.names.length !== 0) {
      console.log(`Found ${this.names.length} packages to load.`);
      this.names.forEach(async (name) => {
        try {
          // Only plugins from the @finos scope are supported
          const resolved = await resolvePlugin(name, { prefix: '@finos' });
          const plugin = await loadPlugin(resolved, { prefix: '@finos' });
          this.pluginModules.concat(plugin);
        } catch (err) {
          console.error(`Unable to load plugin ${name}: ${err}`);
        }
      });
    }
    if (this.paths !== undefined && this.paths.length !== 0) {
      console.log(`Found ${this.paths.length} local plugins to load.`);
      this.paths.forEach(async (p) => {
        try {
          const resolved = await resolvePlugin(path.join(process.cwd(), p));
          const plugin = await loadPlugin(resolved);
          this.pluginModules.concat(plugin);
        } catch (err) {
          console.error(`Unable to load plugin ${p}: ${err}`);
        }
      });
    }
    this.modulesLoaded = true;
  }

  loadPlugins() {
    // This function runs before loadModules finishes. No idea how to resolve
    // since load-plugin package only supports async.
    const plugins = [];
    for (pluginModule in this.pluginModules) {
      // iterate over the module.exports keys
      for (key in Object.keys(pluginModule)) {
        // only extract instances of the GenericPlugin base class
        // add it to the list of loaded plugins
        if (
          Object.prototype.hasOwnProperty.call(pluginModule, key) &&
          p[key] instanceof ProxyPlugin
        ) {
          plugins.concat(p[key]);
        }
      }
    }
    this.plugins = plugins;
    this.loaded = true;
  }
}

/**
 * Parent class for all Git Proxy plugins. New plugin types must inherit from
 * ProxyPlugin to be loaded by PluginManager.
 */
class ProxyPlugin {}

/**
 * A plugin which executes a function when receiving a proxy request.
 */
class GenericPlugin extends ProxyPlugin {
  /**
   * Setup a new instance of GenericPlugin with a custom exec function.
   * @param {function} execFunc A function that executes when a push is proxied.
   */
  constructor(execFunc) {
    super();
    this.pluginType = 'generic';
    this.execFunc = execFunc;
  }

  /**
   *
   * @param {*} request
   * @param {*} action
   */
  execute(request, action) {
    this.execFunc(request, action);
  }
}

const setupPluginManager = async () => {
  // Auto-register plugins that are part of git-proxy core
  let packagePlugins = [];
  let localPlugins = ['./packages/git-proxy-notify-hello/index.js'];
  // How should additional plugins be registered? Environment variable?
  if (process.env.GITPROXY_LOAD_PLUGINS) {
    const plugins = process.env.GITPROXY_LOAD_PLUGINS.split(',');
    plugins
      .filter((p) => {
        p.length !== 0;
      })
      .forEach((p) => {
        // need to differentiate between plugins loaded via file path and
        // ones loaded using Node's builtin name resolution (node_modules)
        if (p.charAt(0) !== '@' && p.includes('/')) {
          localPlugins = localPlugins.concat(p);
        } else {
          packagePlugins = packagePlugins.concat(p);
        }
      });
  }
  const pluginMgr = new PluginManager(packagePlugins, localPlugins);
  await pluginMgr.loadModules();
  pluginMgr.loadPlugins();
  return pluginMgr;
};

module.exports.pluginManager = setupPluginManager();
module.exports.GenericPlugin = GenericPlugin;
module.exports.PluginManager = PluginManager;
