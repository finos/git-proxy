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

import { Action } from '../proxy/actions';
import { ProxyEventRegistry } from './registry';
import {
  ActionEventCallback,
  ActionPhase,
  EventDetails,
  ProxyOperation,
  RepositoryContext,
  UserContext,
} from './types';

const buildRepositoryContext = (action: Action): RepositoryContext => ({
  url: action.url,
  project: action.project,
  name: action.repoName,
});

const buildUserContext = (action: Action): UserContext | undefined => {
  if (!action.user && !action.userEmail) {
    return undefined;
  }
  return { username: action.user, email: action.userEmail };
};

/**
 * Produces a per-handler copy of the event details, including fresh nested
 * objects. Handlers run fire-and-forget and would otherwise share a single
 * `details` reference, so a handler mutating `details.user` or
 * `details.repository` would corrupt what later handlers observe. Cloning
 * isolates each handler without forcing plugin authors to deal with frozen
 * objects. `error` is shared by reference — Error instances do not clone
 * cleanly, and it is the same underlying failure for every handler.
 */
const cloneDetails = (details: EventDetails): EventDetails => ({
  ...details,
  repository: { ...details.repository },
  user: details.user ? { ...details.user } : undefined,
});

/**
 * Translates an Action's type string to the ProxyOperation surfaced to
 * handlers, or null when the action should not produce an event (e.g.
 * "default" actions used for protocol pings).
 */
const operationFor = (action: Action): ProxyOperation | null => {
  if (action.type === 'push') return 'push';
  if (action.type === 'pull') return 'pull';
  return null;
};

export class EventDispatcher {
  private readonly registry: ProxyEventRegistry;
  private readonly inflight: Set<Promise<void>> = new Set();

  constructor(registry: ProxyEventRegistry) {
    this.registry = registry;
  }

  /**
   * Invokes registered handlers for a phase. Returns synchronously — handlers
   * run on the event loop without delaying the request path. Errors thrown by
   * a handler are caught and logged; they never propagate.
   */
  public dispatch(action: Action, phase: ActionPhase, error?: Error): void {
    const operation = operationFor(action);
    if (!operation) return;

    const handlers = this.registry.get(operation, phase);
    if (handlers.length === 0) return;

    const details: EventDetails = {
      actionId: action.id,
      operation,
      phase,
      timestamp: Date.now(),
      repository: buildRepositoryContext(action),
      user: buildUserContext(action),
      error,
    };

    for (const handler of handlers) {
      this.invoke(handler, cloneDetails(details));
    }
  }

  private invoke(handler: ActionEventCallback, details: EventDetails): void {
    const handlerName = handler.name || 'anonymous';
    let promise: Promise<void>;
    try {
      promise = Promise.resolve(handler(details));
    } catch (err) {
      this.logHandlerError(handlerName, details, err);
      return;
    }

    const tracked = promise.catch((err) => this.logHandlerError(handlerName, details, err));
    this.inflight.add(tracked);
    tracked.finally(() => this.inflight.delete(tracked));
  }

  private logHandlerError(handlerName: string, details: EventDetails, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Event handler "${handlerName}" failed for ${details.operation}.${details.phase}: ${message}`,
    );
  }

  /**
   * Awaits in-flight handler promises, bounded by `timeoutMs`. Used by
   * Proxy.stop() to give handlers a chance to finish before the process
   * exits. Handlers still running past the timeout are abandoned with a warning.
   */
  async drain(timeoutMs: number): Promise<void> {
    if (this.inflight.size === 0) return;

    const inflightCount = this.inflight.size;
    const all = Promise.allSettled([...this.inflight]).then(() => undefined);
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeoutMs),
    );
    const result = await Promise.race([all.then(() => 'done' as const), timeout]);
    if (result === 'timeout') {
      console.warn(
        `Event dispatcher drain timed out after ${timeoutMs}ms with ${this.inflight.size}/${inflightCount} handler(s) still running; abandoning.`,
      );
    }
  }
}

let activeDispatcher: EventDispatcher | null = null;

export const setEventDispatcher = (dispatcher: EventDispatcher | null): void => {
  activeDispatcher = dispatcher;
};

export const getEventDispatcher = (): EventDispatcher | null => activeDispatcher;

export const resetEventDispatcher = (): void => {
  activeDispatcher = null;
};
