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

import { IProxyEventRegistry } from './types';

/**
 * A plugin which subscribes one or more event handlers to GitProxy lifecycle
 * events. Loaded at startup from the `eventHandlers` config key.
 *
 * Subclasses (or instances constructed with a `register` function) declare
 * their subscriptions inside `register(registry)`. The registry is the only
 * way handlers are wired in; event handler plugins do not participate in the
 * action chain and cannot block or modify operations.
 */
export class EventHandlerPlugin {
  isGitProxyPlugin: boolean;
  isGitProxyEventHandlerPlugin: boolean;
  register: (registry: IProxyEventRegistry) => void;

  constructor(register: (registry: IProxyEventRegistry) => void) {
    this.isGitProxyPlugin = true;
    this.isGitProxyEventHandlerPlugin = true;
    this.register = register;
  }
}

/**
 * Checks whether a value looks like an EventHandlerPlugin (loaded from an
 * external module). Mirrors `isCompatiblePlugin` in src/plugin.ts but checks
 * for `register` rather than `exec`.
 */
export const isEventHandlerPlugin = (obj: unknown): obj is EventHandlerPlugin => {
  let cursor: unknown = obj;
  while (cursor != null) {
    if (
      typeof cursor === 'object' &&
      Object.prototype.hasOwnProperty.call(cursor, 'isGitProxyEventHandlerPlugin') &&
      (cursor as { isGitProxyEventHandlerPlugin?: unknown }).isGitProxyEventHandlerPlugin ===
        true &&
      typeof (cursor as { register?: unknown }).register === 'function'
    ) {
      return true;
    }
    cursor = Object.getPrototypeOf(cursor);
  }
  return false;
};
