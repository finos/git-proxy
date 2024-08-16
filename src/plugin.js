const lpModule = import('load-plugin');
('use strict');

/**
 * Checks if the given object or any of its prototypes has the 'isGitProxyPlugin' property set to true.
 * @param {Object} obj - The object to check.
 * @param {string} propertyName - The property name to check for. Default is 'isGitProxyPlugin'.
 * @return {boolean} - True if the object or any of its prototypes has the 'isGitProxyPlugin' property set to true, false otherwise.
 */
function isCompatiblePlugin(obj, propertyName = 'isGitProxyPlugin') {
  while (obj != null) {
    if (Object.prototype.hasOwnProperty.call(obj, propertyName) &&
      obj.isGitProxyPlugin &&
      Object.keys(obj).includes('exec')) {
      return true;
    }
    obj = Object.getPrototypeOf(obj);
  }
  return false;
}

/**
 * @typedef PluginTypeResult
 * @property {ProxyPlugin[]} pushPlugins - List of push plugins
 * @property {ProxyPlugin[]} pullPlugins - List of pull plugins
 */

/**
 * Registers and loads plugins used by git-proxy
 */
class PluginLoader {
  /**
   * @property {Promise} load - A Promise that begins loading plugins from a list of modules. Callers must run `await loader.load` to load plugins.
   */
  load;
  /**
   * This property is not used in production code. It is exposed for testing purposes.
   * @property {Promise} ready - A Promise that resolves when all plugins have been loaded.
   */
  ready;
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
    this.pushPlugins = [];
    this.pullPlugins = [];
    if (this.targets.length === 0) {
      console.log('No plugins configured'); // TODO: log.debug()
      this.ready = Promise.resolve();
      this.load = () => Promise.resolve(); // Ensure this.load is always defined
      return;
    }
    this.load = this._loadPlugins();
  }

  async _loadPlugins() {
    try {
      const modulePromises = this.targets.map(target =>
        this._loadPluginModule(target).catch(error => {
          console.error(`Failed to load plugin: ${error}`); // TODO: log.error()
          return Promise.reject(error); // Or return an error object to handle it later
        })
      );

      const moduleResults = await Promise.allSettled(modulePromises);
      const loadedModules = moduleResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      console.log(`Found ${loadedModules.length} plugin modules`); // TODO: log.debug()

      const pluginTypeResultPromises = loadedModules.map(mod =>
        this._getPluginObjects(mod).catch(error => {
          console.error(`Failed to cast plugin objects: ${error}`); // TODO: log.error()
          return Promise.reject(error); // Or return an error object to handle it later
        })
      );

      const settledPluginTypeResults = await Promise.allSettled(pluginTypeResultPromises);
      const pluginTypeResults = settledPluginTypeResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      for (const result of pluginTypeResults) {
        this.pushPlugins.push(...result.pushPlugins)
        this.pullPlugins.push(...result.pullPlugins)
      }

      const combinedPlugins = [...this.pushPlugins, ...this.pullPlugins];
      combinedPlugins.forEach(plugin => {
        console.log(`Loaded plugin: ${plugin.constructor.name}`);
      });

      this.ready = Promise.resolve();
    } catch (error) {
      console.error(`Error loading plugins: ${error}`);
      this.ready = Promise.reject(error);
    }
  }
  /**
   * Load a plugin module from either a file path or a Node module.
   * @param {string} target
   * @return {Module}
   */
  async _loadPluginModule(target) {
    const lp = await lpModule;
    const resolvedModuleFile = await lp.resolvePlugin(target);
    return await lp.loadPlugin(resolvedModuleFile);
  }

  /**
   * Set a list of ProxyPlugin objects to this.plugins
   * from the keys exported by the passed in module.
   * @param {object} pluginModule
   * @return {PluginTypeResult} - An object containing the loaded plugins classified by their type.
   */
  async _getPluginObjects(pluginModule) {
    const plugins = {
      pushPlugins: [],
      pullPlugins: [],
    };
    // handles the case where the `module.exports = new ProxyPlugin()` or `exports default new ProxyPlugin()`
    if (isCompatiblePlugin(pluginModule)) {
      if (isCompatiblePlugin(pluginModule, 'isGitProxyPushActionPlugin')) {
        console.log('found push plugin', pluginModule.constructor.name);
        plugins.pushPlugins.push(pluginModule);
      } else if (isCompatiblePlugin(pluginModule, 'isGitProxyPullActionPlugin')) {
        console.log('found pull plugin', pluginModule.constructor.name);
        plugins.pullPlugins.push(pluginModule);
      } else {
        console.error(`Error: Object ${pluginModule.constructor.name} does not seem to be a compatible plugin type`);
      }
    } else {
      // iterate over the module.exports keys if multiple arbitrary objects are exported
      for (const key of Object.keys(pluginModule)) {
        if (isCompatiblePlugin(pluginModule[key])) {
          if (isCompatiblePlugin(pluginModule[key], 'isGitProxyPushActionPlugin')) {
            console.log('found push plugin', pluginModule[key].constructor.name);
            plugins.pushPlugins.push(pluginModule[key]);
          } else if (isCompatiblePlugin(pluginModule[key], 'isGitProxyPullActionPlugin')) {
            console.log('found pull plugin', pluginModule[key].constructor.name);
            plugins.pullPlugins.push(pluginModule[key]);
          } else {
            console.error(`Error: Object ${pluginModule.constructor.name} does not seem to be a compatible plugin type`);
          }
        }
      }
    }
    return plugins;
  }
}

/**
 * Parent class for all GitProxy plugins. New plugin types must inherit from
 * ProxyPlugin to be loaded by PluginLoader.
 */
class ProxyPlugin {
  constructor() {
    this.isGitProxyPlugin = true;
  }
}

/**
 * A plugin which executes a function when receiving a git push request.
 */
class PushActionPlugin extends ProxyPlugin {
/**
 * Wrapper class which contains at least one function executed as part of the action chain for git push operations.
 * The function must be called `exec` and take in two parameters: an Express Request (req) and the current Action
 * executed in the chain (action). This function should return a Promise that resolves to an Action.
 * 
 * Optionally, child classes which extend this can simply define the `exec` function as their own property.
 * This is the preferred implementation when a custom plugin (subclass) has its own state or additional methods
 * that are required.
 * 
 * @param {function} exec - A function that:
 *   - Takes in an Express Request object as the first parameter (`req`).
 *   - Takes in an Action object as the second parameter (`action`).
 *   - Returns a Promise that resolves to an Action.
 */
  constructor(exec) {
    super();
    this.isGitProxyPushActionPlugin = true;
    this.exec = exec;
  }
}

/**
 * A plugin which executes a function when receiving a git fetch request.
 */
class PullActionPlugin extends ProxyPlugin {
  /**
   * Wrapper class which contains at least one function executed as part of the action chain for git pull operations.
   * The function must be called `exec` and take in two parameters: an Express Request (req) and the current Action
   * executed in the chain (action). This function should return a Promise that resolves to an Action.
   * 
   * Optionally, child classes which extend this can simply define the `exec` function as their own property.
   * This is the preferred implementation when a custom plugin (subclass) has its own state or additional methods
   * that are required.
   * 
   * @param {function} exec - A function that:
   *   - Takes in an Express Request object as the first parameter (`req`).
   *   - Takes in an Action object as the second parameter (`action`).
   *   - Returns a Promise that resolves to an Action.
   */
  constructor(exec) {
    super();
    this.isGitProxyPullActionPlugin = true;
    this.exec = exec;
  }
}

/**
 * 
 * @param {Array<string>} targets A list of loadable targets for plugin modules. 
 * @return {PluginLoader}
 */
const createLoader = async (targets) => {
  const loadTargets = targets;
  const loader = new PluginLoader(loadTargets);
  return loader;
};

module.exports = {
  createLoader,
  PluginLoader,
  PushActionPlugin,
  PullActionPlugin,
  isCompatiblePlugin,
}