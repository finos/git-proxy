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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Action } from '../src/proxy/actions';
import { ProxyEventRegistry } from '../src/eventHandlers/registry';
import { EventDispatcher } from '../src/eventHandlers/dispatcher';
import { EventHandlerPlugin } from '../src/eventHandlers/EventHandlerPlugin';
import { consoleLoggerEventHandler } from '../src/eventHandlers/builtin/consoleLogger';

// Module-level map of "configured target" -> "loaded module value", used by
// the load-plugin mock below to simulate proxy.config.json's eventHandlers
// array resolving to handler modules at runtime.
const fakeModules = new Map<string, unknown>();

vi.mock('load-plugin', () => ({
  resolvePlugin: async (target: string) => target,
  loadPlugin: async (target: string) => {
    if (!fakeModules.has(target)) {
      throw new Error(`No fake module registered for "${target}"`);
    }
    return fakeModules.get(target);
  },
}));

// Imported AFTER vi.mock so the loader picks up the mocked load-plugin.
import { EventHandlerLoader } from '../src/eventHandlers/loader';

const buildPushAction = (): Action => {
  const a = new Action(
    'cfg-action',
    'push',
    'POST',
    Date.now(),
    'https://github.com/finos/git-proxy.git',
  );
  a.user = 'alice';
  a.userEmail = 'alice@example.com';
  return a;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('EventHandlerLoader (configured via proxy.config.json eventHandlers)', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeModules.clear();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('loads the built-in consoleLogger when listed in config and fires its handlers', async () => {
    // Simulate `eventHandlers: ["@finos/git-proxy/eventHandlers/consoleLogger"]`
    // in proxy.config.json by mapping the configured target to the actual
    // shipped EventHandlerPlugin instance.
    const configuredTarget = '@finos/git-proxy/eventHandlers/consoleLogger';
    fakeModules.set(configuredTarget, consoleLoggerEventHandler);

    const registry = new ProxyEventRegistry();
    const loader = new EventHandlerLoader([configuredTarget]);
    await loader.load();
    loader.registerAll(registry);

    expect(loader.plugins).toHaveLength(1);
    expect(loader.plugins[0]).toBe(consoleLoggerEventHandler);

    // The registered handler must actually fire on dispatched events.
    const dispatcher = new EventDispatcher(registry);
    dispatcher.dispatch(buildPushAction(), 'completed');
    await dispatcher.drain(100);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({
      event: 'gitproxy.action',
      operation: 'push',
      phase: 'completed',
      repo: 'https://github.com/finos/git-proxy.git',
      username: 'alice',
      userEmail: 'alice@example.com',
    });
  });

  it('loads multiple handlers from one module (named exports)', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const moduleObject = {
      pushObserver: new EventHandlerPlugin((r) => r.onPush().onCompleted(a)),
      pullObserver: new EventHandlerPlugin((r) => r.onPull().onCompleted(b)),
    };
    fakeModules.set('./fake-multi-export', moduleObject);

    const registry = new ProxyEventRegistry();
    const loader = new EventHandlerLoader(['./fake-multi-export']);
    await loader.load();
    loader.registerAll(registry);

    expect(loader.plugins).toHaveLength(2);

    const dispatcher = new EventDispatcher(registry);
    dispatcher.dispatch(buildPushAction(), 'completed');

    const pullAction = new Action('p', 'pull', 'GET', 0, 'https://github.com/x/y.git');
    dispatcher.dispatch(pullAction, 'completed');
    await dispatcher.drain(100);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('skips modules that do not export an EventHandlerPlugin', async () => {
    fakeModules.set('./not-a-plugin', { hello: 'world' });

    const registry = new ProxyEventRegistry();
    const loader = new EventHandlerLoader(['./not-a-plugin']);
    await loader.load();
    loader.registerAll(registry);

    expect(loader.plugins).toHaveLength(0);
    expect(registry.get('push', 'completed')).toEqual([]);
  });

  it('continues loading when one configured target fails to resolve', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const survivor = vi.fn();
    fakeModules.set('./ok', new EventHandlerPlugin((r) => r.onPush().onStarted(survivor)));
    // './missing' is intentionally not registered — loadPlugin will throw.

    const registry = new ProxyEventRegistry();
    const loader = new EventHandlerLoader(['./missing', './ok']);
    await loader.load();
    loader.registerAll(registry);

    expect(loader.plugins).toHaveLength(1);

    const dispatcher = new EventDispatcher(registry);
    dispatcher.dispatch(buildPushAction(), 'started');
    await sleep(0);
    expect(survivor).toHaveBeenCalledTimes(1);

    errSpy.mockRestore();
  });

  it('isolates a register() that throws so other handlers still register', () => {
    const ok = vi.fn();
    const bad = new EventHandlerPlugin(() => {
      throw new Error('register boom');
    });
    const good = new EventHandlerPlugin((r) => r.onPush().onCompleted(ok));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = new ProxyEventRegistry();
    const loader = new EventHandlerLoader([]);
    loader.plugins.push(bad, good);

    expect(() => loader.registerAll(registry)).not.toThrow();
    expect(registry.get('push', 'completed')).toEqual([ok]);
    errSpy.mockRestore();
  });
});
