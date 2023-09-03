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
  }

  /**
   * Load configured plugins as modules and set each concrete ProxyPlugin
   * to this.plugins for use in proxying.
   */
  loadPlugins() {
    const modulePromises = [];
    for (const path of this.paths) {
      modulePromises.push(this._loadFilePlugin(path));
    }
    for (const name of this.names) {
      modulePromises.push(this._loadPackagePlugin(name));
    }
    Promise.all(modulePromises).then((vals) => {
      this.pluginModules = vals;
      console.log(`Found ${this.pluginModules.length} plugin modules`);
      const pluginObjPromises = [];
      for (const mod of this.pluginModules) {
        pluginObjPromises.push(this._castToPluginObjects(mod));
      }
      Promise.all(pluginObjPromises).then((vals) => {
        this.plugins = this.plugins.concat(vals);
        console.log(`Loaded ${this.plugins.length} plugins`);
      });
    });
  }

  async _loadFilePlugin(filepath) {
    const lp = await lpModule;
    const resolvedModuleFile = await lp.resolvePlugin(
      path.join(process.cwd(), filepath),
    );
    return await lp.loadPlugin(resolvedModuleFile);
  }

  async _loadPackagePlugin(packageName) {
    const lp = await lpModule;
    const resolvedPackageFile = await lp.resolvePlugin(packageName, {
      prefix: '@finos',
    });
    return await lp.loadPlugin(resolvedPackageFile);
  }

  async _castToPluginObjects(pluginModule) {
    const plugins = [];
    // iterate over the module.exports keys
    for (const key of Object.keys(pluginModule)) {
      // only extract instances of the GenericPlugin base class
      // add it to the list of loaded plugins
      if (
        Object.prototype.hasOwnProperty.call(pluginModule, key) &&
        pluginModule[key] instanceof ProxyPlugin
      ) {
        plugins.push(pluginModule[key]);
      }
    }
    return plugins;
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

const setupPluginManager = () => {
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
  pluginMgr.loadPlugins();
  return pluginMgr;
};

module.exports.pluginManager = setupPluginManager();
module.exports.GenericPlugin = GenericPlugin;
module.exports.PluginManager = PluginManager;
