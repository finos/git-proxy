const path = require('path');
const lpModule = import('load-plugin');
('use strict');

/**
 * Finds, registers and loads plugins used by git-proxy
 */
class PluginLoader {
  /**
   * Initialize PluginLoader with candidates modules (node_modules or relative
   * file paths).
   * @param {Array.<string>} names List of Node module/package names to load.
   * @param {Array.<string>} paths List of file paths to load modules from.
   */
  constructor(names, paths) {
    this.names = names;
    this.paths = paths;
    /**
     * @type {Array.<ProxyPlugin>} List of ProxyPlugin objects loaded.
     * @public
     */
    this.plugins = [];
  }

  /**
   * Load configured plugins as modules and set each concrete ProxyPlugin
   * to this.plugins for use in proxying.
   */
  load() {
    const modulePromises = [];
    for (const path of this.paths) {
      modulePromises.push(this._loadFilePlugin(path));
    }
    for (const name of this.names) {
      modulePromises.push(this._loadPackagePlugin(name));
    }
    Promise.all(modulePromises).then((vals) => {
      const modules = vals;
      console.log(`Found ${modules.length} plugin modules`);
      const pluginObjPromises = [];
      for (const mod of modules) {
        pluginObjPromises.push(this._castToPluginObjects(mod));
      }
      Promise.all(pluginObjPromises).then((vals) => {
        for (const pluginObjs of vals) {
          this.plugins = this.plugins.concat(pluginObjs);
        }
        console.log(`Loaded ${this.plugins.length} plugins`);
      });
    });
  }

  /**
   * Load a plugin module from a relative file path to the
   * current working directory.
   * @param {string} filepath
   * @return {Module}
   */
  async _loadFilePlugin(filepath) {
    const lp = await lpModule;
    const resolvedModuleFile = await lp.resolvePlugin(
      path.join(process.cwd(), filepath),
    );
    return await lp.loadPlugin(resolvedModuleFile);
  }

  /**
   * Load a plugin module from the specified Node module. Only
   * modules with the prefix "@finos" are supported.
   * @param {string} packageName
   * @return {Module}
   */
  async _loadPackagePlugin(packageName) {
    const lp = await lpModule;
    const resolvedPackageFile = await lp.resolvePlugin(packageName, {
      prefix: '@finos',
    });
    return await lp.loadPlugin(resolvedPackageFile);
  }

  /**
   * Set a list of ProxyPlugin objects to this.plugins
   * from the keys exported by the passed in module.
   * @param {Module} pluginModule
   * @return {ProxyPlugin}
   */
  async _castToPluginObjects(pluginModule) {
    const plugins = [];
    // iterate over the module.exports keys
    for (const key of Object.keys(pluginModule)) {
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
 * ProxyPlugin to be loaded by PluginLoader.
 */
class ProxyPlugin {}

/**
 * A plugin which executes a function when receiving a proxy request.
 */
class ActionPlugin extends ProxyPlugin {
  /**
   * Custom function executed as part of the action chain. The function
   * must take in two parameters, an {@link https://expressjs.com/en/4x/api.html#req Express Request}
   * and the current Action executed in the chain.
   * @param {Promise<Action>} exec A Promise that returns an Action &
   *                               executes when a push is proxied.
   */
  constructor(exec) {
    super();
    this.exec = exec;
  }
}

const createLoader = async () => {
  // Auto-register plugins that are part of git-proxy core
  let names = [];
  let files = [];
  if (process.env.GITPROXY_PLUGIN_PACKAGES !== undefined) {
    names = process.env.GITPROXY_PLUGIN_PACKAGES.split(',');
  }
  if (process.env.GITPROXY_PLUGIN_FILES !== undefined) {
    files = process.env.GITPROXY_PLUGIN_FILES.split(',');
  }
  const loader = new PluginLoader(names, files);
  if (names.length + files.length > 0) {
    loader.load();
  }
  return loader;
};

module.exports.defaultLoader = createLoader();
module.exports.ProxyPlugin = ProxyPlugin;
module.exports.ActionPlugin = ActionPlugin;
// exported for testing only
module.exports.createLoader = createLoader;
