const config = require('./config');
const lpModule = import('load-plugin');
('use strict');

/**
 * Registers and loads plugins used by git-proxy
 */
class PluginLoader {
  /**
   * Initialize PluginLoader with candidates modules (node_modules or relative
   * file paths).
   * @param {Array.<string>} targets List of Node module package names or files to load.
   */
  constructor(targets) {
    this.targets = targets;
    /**
     * @type {ProxyPlugin[]} List of loaded ProxyPlugins
     * @public
     */
    this.plugins = [];
    if (this.targets.length === 0) {
      console.log('No plugins configured'); // TODO: log.debug()
      return;
    }
    const modulePromises = [];
    for (const target of this.targets) {
      modulePromises.push(this._loadPlugin(target));
    }
    Promise.all(modulePromises).then((vals) => {
      const modules = vals;
      console.log(`Found ${modules.length} plugin modules`); // TODO: log.debug()
      const pluginObjPromises = [];
      for (const mod of modules) {
        pluginObjPromises.push(this._castToPluginObjects(mod));
      }
      Promise.all(pluginObjPromises).then((vals) => {
        for (const pluginObjs of vals) {
          this.plugins = this.plugins.concat(pluginObjs);
        }
        console.log(`Loaded ${this.plugins.length} plugins`); // TODO: log.debug()
      });
    });
  }

  /**
   * Load a plugin module from either a file path or a Node module.
   * @param {string} target
   * @return {Module}
   */
  async _loadPlugin(target) {
    const lp = await lpModule;
    try {
      const resolvedModuleFile = await lp.resolvePlugin(target);
      return await lp.loadPlugin(resolvedModuleFile);  
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Set a list of ProxyPlugin objects to this.plugins
   * from the keys exported by the passed in module.
   * @param {object} pluginModule
   * @return {ProxyPlugin}
   */
  async _castToPluginObjects(pluginModule) {
    const plugins = [];
    if (pluginModule instanceof ProxyPlugin) {
      return [pluginModule];
    }
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
 * Parent class for all GitProxy plugins. New plugin types must inherit from
 * ProxyPlugin to be loaded by PluginLoader.
 */
class ProxyPlugin {}

/**
 * A plugin which executes a function when receiving a proxy request.
 */
class PushActionPlugin extends ProxyPlugin {
/**
 * Custom function executed as part of the action chain. The function
 * must take in two parameters: an Express Request and the current Action
 * executed in the chain. This function should return a Promise that resolves
 * to an Action.
 * 
 * @param {function} exec - A function that:
 *   - Takes in an Express Request object as the first parameter (`req`).
 *   - Takes in an Action object as the second parameter (`action`).
 *   - Returns a Promise that resolves to an Action.
 */
  constructor(exec) {
    super();
    this.exec = exec;
  }
}

class ActionPlugin extends ProxyPlugin {
  constructor(exec) {
    super();
    this.exec = exec;
  }
}

/**
 * 
 * @param {Array<string>} targets A list of loadable targets for plugin modules. 
 * @return {PluginLoader}
 */
const createLoader = async () => {
  const loadTargets = [...config.getPushPlugins()]
  if (process.env.GITPROXY_PLUGIN_FILES) {
    console.log('Note: GITPROXY_PLUGIN_FILES is deprecated. Please configure plugins to load via configuration (proxy.config.json).')
    const pluginFiles = process.env.GITPROXY_PLUGIN_FILES.split(',');
    loadTargets.push(...pluginFiles);
  }
  if (process.env.GITPROXY_PLUGIN_PACKAGES) {
    console.log('Note: GITPROXY_PLUGIN_PACKAGES is deprecated. Please configure plugins to load via configuration (proxy.config.json).')
    const pluginPackages = process.env.GITPROXY_PLUGIN_PACKAGES.split(',');
    loadTargets.push(...pluginPackages);
  }
  const loader = new PluginLoader(loadTargets);
  return loader;
};

/**
 * Default PluginLoader used by the proxy chain. This is a singleton.
 * @type {PluginLoader}
 */
let _defaultLoader;

module.exports = {
  get defaultLoader() {
    if (!_defaultLoader) {
      _defaultLoader = createLoader();
    }
    return _defaultLoader;
  },
  set defaultLoader(loader) {
    _defaultLoader = loader;
  },
  ProxyPlugin,
  ActionPlugin, // deprecated
  PushActionPlugin,
  createLoader
}