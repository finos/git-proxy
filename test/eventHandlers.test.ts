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
import {
  EventDispatcher,
  getEventDispatcher,
  resetEventDispatcher,
  setEventDispatcher,
} from '../src/eventHandlers/dispatcher';
import { EventHandlerPlugin, isEventHandlerPlugin } from '../src/eventHandlers/EventHandlerPlugin';
import { consoleLoggerEventHandler } from '../src/eventHandlers/builtin/consoleLogger';
import { EventDetails } from '../src/eventHandlers/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const buildPushAction = (overrides: Partial<Action> = {}): Action => {
  const a = new Action(
    'action-1',
    'push',
    'POST',
    Date.now(),
    'https://github.com/finos/git-proxy.git',
  );
  a.user = 'alice';
  a.userEmail = 'alice@example.com';
  return Object.assign(a, overrides);
};

describe('ProxyEventRegistry', () => {
  it('chains phase subscriptions and stores them per operation', () => {
    const registry = new ProxyEventRegistry();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    registry.onPush().onCompleted(a).onError(b).onPendingReview(c);
    expect(registry.get('push', 'completed')).toEqual([a]);
    expect(registry.get('push', 'error')).toEqual([b]);
    expect(registry.get('push', 'pendingReview')).toEqual([c]);
    expect(registry.get('pull', 'completed')).toEqual([]);
  });

  it('keeps push and pull handlers separate', () => {
    const registry = new ProxyEventRegistry();
    const onPush = vi.fn();
    const onPull = vi.fn();
    registry.onPush().onStarted(onPush);
    registry.onPull().onStarted(onPull);
    expect(registry.get('push', 'started')).toEqual([onPush]);
    expect(registry.get('pull', 'started')).toEqual([onPull]);
  });
});

describe('EventDispatcher.dispatch', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns synchronously even when handlers are async', () => {
    const registry = new ProxyEventRegistry();
    let resolved = false;
    registry.onPush().onCompleted(async () => {
      await sleep(20);
      resolved = true;
    });
    const dispatcher = new EventDispatcher(registry);

    const before = Date.now();
    dispatcher.dispatch(buildPushAction(), 'completed');
    const elapsed = Date.now() - before;
    expect(elapsed).toBeLessThan(10);
    expect(resolved).toBe(false);
  });

  it('passes EventDetails with action fields to handlers', async () => {
    const registry = new ProxyEventRegistry();
    const captured: EventDetails[] = [];
    registry.onPush().onCompleted((d) => {
      captured.push(d);
    });
    const dispatcher = new EventDispatcher(registry);

    dispatcher.dispatch(buildPushAction(), 'completed');
    await dispatcher.drain(100);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      operation: 'push',
      phase: 'completed',
      repository: {
        url: 'https://github.com/finos/git-proxy.git',
        project: 'finos',
        name: 'git-proxy.git',
      },
      user: { username: 'alice', email: 'alice@example.com' },
    });
  });

  it('skips dispatch entirely for default-typed actions', async () => {
    const registry = new ProxyEventRegistry();
    const handler = vi.fn();
    registry.onPush().onCompleted(handler);
    registry.onPull().onCompleted(handler);
    const dispatcher = new EventDispatcher(registry);

    const action = new Action('id', 'default', 'GET', 0, 'https://github.com/x/y.git');
    dispatcher.dispatch(action, 'completed');
    await dispatcher.drain(50);

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler errors from each other and does not throw', async () => {
    const registry = new ProxyEventRegistry();
    const ok = vi.fn();
    registry
      .onPush()
      .onCompleted(() => {
        throw new Error('sync boom');
      })
      .onCompleted(async () => {
        throw new Error('async boom');
      })
      .onCompleted(ok);
    const dispatcher = new EventDispatcher(registry);

    expect(() => dispatcher.dispatch(buildPushAction(), 'completed')).not.toThrow();
    await dispatcher.drain(100);

    expect(ok).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('clones EventDetails per handler so nested mutations do not leak (see cloneDetails)', async () => {
    const registry = new ProxyEventRegistry();
    let secondHandlerUser: EventDetails['user'];
    let secondHandlerRepoName: string | undefined;
    registry
      .onPush()
      .onCompleted((d) => {
        // Handler 1 mutates nested fields on its own copy.
        if (d.user) d.user.username = 'mutated-by-handler-1';
        d.repository.name = 'mutated-by-handler-1';
      })
      .onCompleted((d) => {
        // Handler 2 must observe clean data, not handler 1's mutations.
        secondHandlerUser = d.user;
        secondHandlerRepoName = d.repository.name;
      });
    const dispatcher = new EventDispatcher(registry);

    dispatcher.dispatch(buildPushAction(), 'completed');
    await dispatcher.drain(100);

    expect(secondHandlerUser).toEqual({ username: 'alice', email: 'alice@example.com' });
    expect(secondHandlerRepoName).toBe('git-proxy.git');
  });

  it('drain awaits in-flight handler promises', async () => {
    const registry = new ProxyEventRegistry();
    let finished = false;
    registry.onPush().onCompleted(async () => {
      await sleep(50);
      finished = true;
    });
    const dispatcher = new EventDispatcher(registry);

    dispatcher.dispatch(buildPushAction(), 'completed');
    await dispatcher.drain(500);
    expect(finished).toBe(true);
  });

  it('drain warns and returns when timeout expires before handlers settle', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new ProxyEventRegistry();
    registry.onPush().onCompleted(async () => {
      await sleep(200);
    });
    const dispatcher = new EventDispatcher(registry);

    dispatcher.dispatch(buildPushAction(), 'completed');
    await dispatcher.drain(20);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('module-level dispatcher singleton', () => {
  afterEach(() => {
    resetEventDispatcher();
  });

  it('set / get / reset round-trip', () => {
    const d = new EventDispatcher(new ProxyEventRegistry());
    expect(getEventDispatcher()).toBeNull();
    setEventDispatcher(d);
    expect(getEventDispatcher()).toBe(d);
    resetEventDispatcher();
    expect(getEventDispatcher()).toBeNull();
  });
});

describe('EventHandlerPlugin', () => {
  it('marks instances as compatible plugins', () => {
    const plugin = new EventHandlerPlugin(() => {});
    expect(isEventHandlerPlugin(plugin)).toBe(true);
    expect(plugin.isGitProxyPlugin).toBe(true);
    expect(plugin.isGitProxyEventHandlerPlugin).toBe(true);
  });

  it('rejects unrelated objects', () => {
    expect(isEventHandlerPlugin({})).toBe(false);
    expect(isEventHandlerPlugin({ isGitProxyEventHandlerPlugin: true })).toBe(false);
    expect(isEventHandlerPlugin(null)).toBe(false);
  });

  it('register() is invoked with the registry', () => {
    const fn = vi.fn();
    const plugin = new EventHandlerPlugin(fn);
    const registry = new ProxyEventRegistry();
    plugin.register(registry);
    expect(fn).toHaveBeenCalledWith(registry);
  });
});

describe('consoleLoggerEventHandler', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('logs a structured JSON line for every push phase', async () => {
    const registry = new ProxyEventRegistry();
    consoleLoggerEventHandler.register(registry);
    const dispatcher = new EventDispatcher(registry);

    dispatcher.dispatch(buildPushAction(), 'started');
    dispatcher.dispatch(buildPushAction(), 'completed');
    dispatcher.dispatch(buildPushAction(), 'pendingReview');
    dispatcher.dispatch(buildPushAction(), 'permissionDenied');
    dispatcher.dispatch(buildPushAction(), 'error', new Error('boom'));
    await dispatcher.drain(100);

    expect(infoSpy).toHaveBeenCalledTimes(5);
    const logged = infoSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(logged.map((l) => l.phase)).toEqual([
      'started',
      'completed',
      'pendingReview',
      'permissionDenied',
      'error',
    ]);
    expect(logged[4].error).toBe('boom');
    for (const line of logged) {
      expect(line.event).toBe('gitproxy.action');
      expect(line.operation).toBe('push');
    }
  });
});
