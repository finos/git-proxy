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

import { loadPlugin, resolvePlugin } from 'load-plugin';

import { handleErrorAndLog } from '../utils/errors';
import { EventHandlerPlugin, isEventHandlerPlugin } from './EventHandlerPlugin';
import { IProxyEventRegistry } from './types';

/**
 * Loads event handler modules listed in the `eventHandlers` config key and
 * registers their handlers on the supplied registry. Mirrors the structure of
 * `PluginLoader` in src/plugin.ts so deployers see the same module-resolution
 * behaviour as for chain plugins.
 */
export class EventHandlerLoader {
  targets: string[];
  plugins: EventHandlerPlugin[] = [];

  constructor(targets: string[]) {
    this.targets = targets;
    if (targets.length === 0) {
      console.log('No event handlers configured');
    }
  }

  async load(): Promise<void> {
    try {
      const moduleResults = await Promise.allSettled(
        this.targets.map((target) =>
          this.loadModule(target).catch((error) => {
            console.error(`Failed to load event handler: ${error}`);
            return Promise.reject(error);
          }),
        ),
      );

      const modules = moduleResults
        .filter(
          (r): r is PromiseFulfilledResult<unknown> =>
            r.status === 'fulfilled' && r.value !== null && r.value !== undefined,
        )
        .map((r) => r.value);

      console.log(`Found ${modules.length} event handler module(s)`);

      for (const mod of modules) {
        this.collect(mod);
      }

      this.plugins.forEach((p) =>
        console.log(`Loaded event handler: ${p.constructor?.name ?? 'EventHandlerPlugin'}`),
      );
    } catch (error: unknown) {
      handleErrorAndLog(error, 'Error loading event handlers');
    }
  }

  registerAll(registry: IProxyEventRegistry): void {
    for (const plugin of this.plugins) {
      try {
        plugin.register(registry);
      } catch (error: unknown) {
        handleErrorAndLog(
          error,
          `Failed to register event handler ${plugin.constructor?.name ?? 'EventHandlerPlugin'}`,
        );
      }
    }
  }

  private async loadModule(target: string): Promise<unknown> {
    const resolved = await resolvePlugin(target);
    return loadPlugin(resolved);
  }

  private collect(mod: unknown): void {
    if (mod === null || typeof mod !== 'object') return;

    if (isEventHandlerPlugin(mod)) {
      this.plugins.push(mod);
      return;
    }

    for (const key of Object.keys(mod as Record<string, unknown>)) {
      const value = (mod as Record<string, unknown>)[key];
      if (isEventHandlerPlugin(value)) {
        this.plugins.push(value);
      }
    }
  }
}
