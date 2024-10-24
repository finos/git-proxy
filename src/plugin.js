const lpModule = import('load-plugin');
('use strict');

/**
 * Checks if the given object or any of its prototypes has the 'isGitProxyPlugin' property set to true.
 * @param {Object} obj - The object to check.
 * @param {string} propertyName - The property name to check for. Default is 'isGitProxyPlugin'.
 * @return {boolean} - True if the object or any of its prototypes has the 'isGitProxyPlugin' property set to true, false otherwise.
 */
function isCompatiblePlugin(obj, propertyName = 'isGitProxyPlugin') {
  // loop through the prototype chain to check if the object is a ProxyPlugin
  // valid plugin objects will have the appropriate property set to true
  // if the prototype chain is exhausted, return false
  while (obj != null) {
    if (
      Object.prototype.hasOwnProperty.call(obj, propertyName) &&
      obj.isGitProxyPlugin &&
      Object.keys(obj).includes('exec')
    ) {
      return true;
    }
    obj = Object.getPrototypeOf(obj);
  }
  return false;
}

/**
 * @typedef PluginTypeResult
 * @property {PushActionPlugin[]} pushAction - List of push action plugins
 * @property {PullActionPlugin[]} pullAction - List of pull action plugins
 */

/**
 * Registers and loads plugins used by git-proxy
 */
class PluginLoader {
  constructor(targets) {
    /**
     * List of Node module specifiers to load as plugins. It can be a relative path, an
     * absolute path, or a module name (which can include scoped packages like '@bar/baz').
     * @type {string[]}
     * @public
     */
    this.targets = targets;
    /**
     * List of loaded PushActionPlugin objects.
     * @type {PushActionPlugin[]}
     * @public
     */
    this.pushPlugins = [];
    /**
     * List of loaded PullActionPlugin objects.
     * @type {PullActionPlugin[]}
     * @public
     */
    this.pullPlugins = [];
    if (this.targets.length === 0) {
      console.log('No plugins configured'); // TODO: log.debug()
    }
  }

  /**
   * Load all plugins specified in the `targets` property. This method must complete before a PluginLoader instance
   * can be used to retrieve plugins.
   * @return {Promise<void>} A Promise that resolves when all plugins have been loaded.
   */
  async load() {
    try {
      const modulePromises = this.targets.map((target) =>
        this._loadPluginModule(target).catch((error) => {
          console.error(`Failed to load plugin: ${error}`); // TODO: log.error()
          return Promise.reject(error); // Or return an error object to handle it later
        }),
      );

      const moduleResults = await Promise.allSettled(modulePromises);
      const loadedModules = moduleResults
        .filter((result) => result.status === 'fulfilled' && result.value !== null)
        .map((result) => result.value);

      console.log(`Found ${loadedModules.length} plugin modules`); // TODO: log.debug()

      const pluginTypeResultPromises = loadedModules.map((mod) =>
        this._getPluginObjects(mod).catch((error) => {
          console.error(`Failed to cast plugin objects: ${error}`); // TODO: log.error()
          return Promise.reject(error); // Or return an error object to handle it later
        }),
      );

      const settledPluginTypeResults = await Promise.allSettled(pluginTypeResultPromises);
      /**
       * @type {PluginTypeResult[]} List of resolved PluginTypeResult objects
       */
      const pluginTypeResults = settledPluginTypeResults
        .filter((result) => result.status === 'fulfilled' && result.value !== null)
        .map((result) => result.value);

      for (const result of pluginTypeResults) {
        this.pushPlugins.push(...result.pushAction);
        this.pullPlugins.push(...result.pullAction);
      }

      const combinedPlugins = [...this.pushPlugins, ...this.pullPlugins];
      combinedPlugins.forEach((plugin) => {
        console.log(`Loaded plugin: ${plugin.constructor.name}`);
      });
    } catch (error) {
      console.error(`Error loading plugins: ${error}`);
    }
  }

  /**
   * Resolve & load a Node module from either a given specifier (file path, import specifier or package name) using load-plugin.
   * @param {string} target The module specifier to load
   * @return {Promise<Module>} A resolved & loaded Module
   */
  async _loadPluginModule(target) {
    const lp = await lpModule;
    const resolvedModuleFile = await lp.resolvePlugin(target);
    return await lp.loadPlugin(resolvedModuleFile);
  }

  /**
   * Checks for known compatible plugin objects in a Module and returns them classified by their type.
   * @param {Module} pluginModule The module to extract plugins from
   * @return {Promise<PluginTypeResult>} An object containing the loaded plugins classified by their type.
   */
  async _getPluginObjects(pluginModule) {
    const plugins = {
      pushAction: [],
      pullAction: [],
    };

    function handlePlugin(potentialModule) {
      if (isCompatiblePlugin(potentialModule, 'isGitProxyPushActionPlugin')) {
        console.log('found push plugin', potentialModule.constructor.name);
        plugins.pushAction.push(potentialModule);
      } else if (isCompatiblePlugin(potentialModule, 'isGitProxyPullActionPlugin')) {
        console.log('found pull plugin', potentialModule.constructor.name);
        plugins.pullAction.push(potentialModule);
      } else {
        console.error(
          `Error: Object ${potentialModule.constructor.name} does not seem to be a compatible plugin type`,
        );
      }
    }

    // handles the default export case
    // `module.exports = new ProxyPlugin()` in CJS or `exports default new ProxyPlugin()` in ESM
    // the "module" is a single object that could be a plugin
    if (isCompatiblePlugin(pluginModule)) {
      handlePlugin(pluginModule);
    } else {
      // handle the typical case of a module which exports multiple objects
      // module.exports = { x, y } (CJS) or multiple `export ...` statements (ESM)
      for (const key of Object.keys(pluginModule)) {
        if (isCompatiblePlugin(pluginModule[key])) {
          handlePlugin(pluginModule[key]);
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

module.exports = {
  PluginLoader,
  PushActionPlugin,
  PullActionPlugin,
  isCompatiblePlugin,
};
