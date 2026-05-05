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

import {
  ActionEventCallback,
  ActionErrorEventCallback,
  ActionPhase,
  IActionEventHandler,
  IProxyEventRegistry,
  ProxyOperation,
} from './types';

type HandlerKey = `${ProxyOperation}:${ActionPhase}`;

const keyFor = (op: ProxyOperation, phase: ActionPhase): HandlerKey => `${op}:${phase}`;

class ActionEventHandlerBuilder implements IActionEventHandler {
  private readonly registry: ProxyEventRegistry;
  private readonly operation: ProxyOperation;

  constructor(registry: ProxyEventRegistry, operation: ProxyOperation) {
    this.registry = registry;
    this.operation = operation;
  }

  onStarted(handler: ActionEventCallback): IActionEventHandler {
    this.registry.add(this.operation, 'started', handler);
    return this;
  }

  onCompleted(handler: ActionEventCallback): IActionEventHandler {
    this.registry.add(this.operation, 'completed', handler);
    return this;
  }

  onError(handler: ActionErrorEventCallback): IActionEventHandler {
    this.registry.add(this.operation, 'error', handler);
    return this;
  }

  onPermissionDenied(handler: ActionEventCallback): IActionEventHandler {
    this.registry.add(this.operation, 'permissionDenied', handler);
    return this;
  }
}

export class ProxyEventRegistry implements IProxyEventRegistry {
  private readonly handlers: Map<HandlerKey, ActionEventCallback[]> = new Map();

  onPush(): IActionEventHandler {
    return new ActionEventHandlerBuilder(this, 'push');
  }

  onPull(): IActionEventHandler {
    return new ActionEventHandlerBuilder(this, 'pull');
  }

  add(operation: ProxyOperation, phase: ActionPhase, handler: ActionEventCallback): void {
    const key = keyFor(operation, phase);
    const existing = this.handlers.get(key);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(key, [handler]);
    }
  }

  get(operation: ProxyOperation, phase: ActionPhase): ActionEventCallback[] {
    return this.handlers.get(keyFor(operation, phase)) ?? [];
  }
}
