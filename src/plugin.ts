/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request } from 'express';
import { loadPlugin, resolvePlugin } from 'load-plugin';
import Module from 'node:module';

import { Action } from './proxy/actions';
import { handleErrorAndLog } from './utils/errors';

/* eslint-disable @typescript-eslint/no-unused-expressions */
('use strict');

/**
 * Checks if the given object or any of its prototypes has the 'isGitProxyPlugin' property set to true.
 * @param {Object} obj - The object to check.
 * @param {string} propertyName - The property name to check for. Default is 'isGitProxyPlugin'.
 * @return {boolean} - True if the object or any of its prototypes has the 'isGitProxyPlugin' property set to true, false otherwise.
 */
function isCompatiblePlugin(obj: any, propertyName: string = 'isGitProxyPlugin'): boolean {
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

interface PluginTypeResult {
  pushAction: PushActionPlugin[];
  pullAction: PullActionPlugin[];
}

/**
 * Registers and loads plugins used by git-proxy
 */
class PluginLoader {
  targets: string[];
  pushPlugins: PushActionPlugin[];
  pullPlugins: PullActionPlugin[];

  constructor(targets: string[]) {
    this.targets = targets;
    this.pushPlugins = [];
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
  async load(): Promise<void> {
    try {
      const modulePromises = this.targets.map((target) =>
        this._loadPluginModule(target).catch((error) => {
          console.error(`Failed to load plugin: ${error}`); // TODO: log.error()
          return Promise.reject(error); // Or return an error object to handle it later
        }),
      );

      const moduleResults = await Promise.allSettled(modulePromises);
      const loadedModules = moduleResults
        .filter(
          (result): result is PromiseFulfilledResult<Module> =>
            result.status === 'fulfilled' && result.value !== null,
        )
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
        .filter(
          (result): result is PromiseFulfilledResult<PluginTypeResult> =>
            result.status === 'fulfilled' && result.value !== null,
        )
        .map((result) => result.value);

      for (const result of pluginTypeResults) {
        this.pushPlugins.push(...result.pushAction);
        this.pullPlugins.push(...result.pullAction);
      }

      const combinedPlugins = [...this.pushPlugins, ...this.pullPlugins];
      combinedPlugins.forEach((plugin) => {
        console.log(`Loaded plugin: ${plugin.constructor.name}`);
      });
    } catch (error: unknown) {
      handleErrorAndLog(error, 'Error loading plugins');
    }
  }

  /**
   * Resolve & load a Node module from either a given specifier (file path, import specifier or package name) using load-plugin.
   * @param {string} target The module specifier to load
   * @return {Promise<unknown>} A resolved & loaded Module
   */
  private async _loadPluginModule(target: string): Promise<unknown> {
    const resolvedModuleFile = await resolvePlugin(target);
    return loadPlugin(resolvedModuleFile);
  }

  /**
   * Checks for known compatible plugin objects in a Module and returns them classified by their type.
   * @param {Module} pluginModule The module to extract plugins from
   * @return {Promise<PluginTypeResult>} An object containing the loaded plugins classified by their type.
   */
  private async _getPluginObjects(pluginModule: any): Promise<PluginTypeResult> {
    const plugins: PluginTypeResult = {
      pushAction: [],
      pullAction: [],
    };

    function handlePlugin(potentialModule: any) {
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
  isGitProxyPlugin: boolean;

  constructor() {
    this.isGitProxyPlugin = true;
  }
}

/**
 * Where in the push chain a {@link PushActionPlugin} should run.
 * - `'start'` (default): the plugin runs before all built-in processors. This preserves the
 *   historical behaviour. At this point only commit metadata is available; the remote has not
 *   been cloned and no diff has been computed.
 * - `'afterDiff'`: the plugin runs immediately after the built-in `getDiff` processor, once the
 *   remote has been cloned, the incoming pack has been written and the unified diff is available.
 *   Use this for plugins that need to inspect changed file contents (e.g. dependency /
 *   supply-chain scanners). Tag pushes have no diff, so such plugins run just before the final
 *   authorisation gate on the tag chain.
 */
type PushChainPhase = 'start' | 'afterDiff';

/**
 * A plugin which executes a function when receiving a git push request.
 */
class PushActionPlugin extends ProxyPlugin {
  isGitProxyPushActionPlugin: boolean;
  exec: (req: Request, action: Action) => Promise<Action>;
  chainPhase: PushChainPhase;

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
   * @param {object} [options] - Optional plugin options.
   * @param {PushChainPhase} [options.chainPhase='start'] - When the plugin runs in the push chain.
   *   Use `'afterDiff'` to run after the built-in diff has been computed so the plugin can inspect
   *   changed file contents.
   */
  constructor(
    exec: (req: Request, action: Action) => Promise<Action>,
    options: { chainPhase?: PushChainPhase } = {},
  ) {
    super();
    this.isGitProxyPushActionPlugin = true;
    this.exec = exec;
    this.chainPhase = options.chainPhase ?? 'start';
  }
}

/**
 * Where in the pull chain a {@link PullActionPlugin} should run.
 * - `'start'` (default): the plugin runs before all built-in pull processors (historical behaviour).
 *   Only repo/user metadata is available.
 * - `'afterAuth'`: the plugin runs after the built-in `checkRepoInAuthorisedList` step, i.e. once the
 *   repository has been confirmed as authorised. Use this for plugins that fetch and inspect the
 *   repository content on pull (e.g. supply-chain scanners) so they don't do so for unauthorised repos.
 */
type PullChainPhase = 'start' | 'afterAuth';

/**
 * A plugin which executes a function when receiving a git fetch request.
 */
class PullActionPlugin extends ProxyPlugin {
  isGitProxyPullActionPlugin: boolean;
  exec: (req: Request, action: Action) => Promise<Action>;
  chainPhase: PullChainPhase;

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
   * @param {object} [options] - Optional plugin options.
   * @param {PullChainPhase} [options.chainPhase='start'] - When the plugin runs in the pull chain.
   *   Use `'afterAuth'` to run after the repository has been confirmed as authorised.
   */
  constructor(
    exec: (req: Request, action: Action) => Promise<Action>,
    options: { chainPhase?: PullChainPhase } = {},
  ) {
    super();
    this.isGitProxyPullActionPlugin = true;
    this.exec = exec;
    this.chainPhase = options.chainPhase ?? 'start';
  }
}

export { PluginLoader, PushActionPlugin, PullActionPlugin, isCompatiblePlugin };
export type { PushChainPhase, PullChainPhase };
