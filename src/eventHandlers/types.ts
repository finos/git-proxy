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

/**
 * Logical operations exposed to event handlers. Mirrors Action.type for the
 * subset that is meaningful to integrations. `pull` covers all git-upload-pack
 * operations (fetch / clone / pull) — git-proxy does not distinguish them.
 */
export type ProxyOperation = 'push' | 'pull';

/**
 * Lifecycle phase of an action.
 *
 * - `started`: parseAction has succeeded; the chain is about to run. User
 *   identity may not yet be resolved at this point.
 * - `completed`: the chain ran to its terminal step and reached a resolved
 *   outcome — the push was approved (allowPush=true) or auto-approved /
 *   auto-rejected by the system.
 * - `pendingReview`: the chain ran to its terminal step and the push was
 *   blocked awaiting manual approval. This is not a denial or an error; the
 *   push sits in the approval queue until a reviewer acts on it.
 * - `error`: an unhandled exception or step error aborted the chain.
 * - `permissionDenied`: the user lacks push permission for the repo.
 */
export type ActionPhase = 'started' | 'completed' | 'pendingReview' | 'error' | 'permissionDenied';

export interface RepositoryContext {
  url: string;
  project: string;
  name: string;
}

export interface UserContext {
  username?: string;
  email?: string;
}

export interface EventDetails {
  actionId: string;
  operation: ProxyOperation;
  phase: ActionPhase;
  timestamp: number;
  repository: RepositoryContext;
  user?: UserContext;
  error?: Error;
}

export type ActionEventCallback = (details: EventDetails) => void | Promise<void>;
export type ActionErrorEventCallback = (details: EventDetails) => void | Promise<void>;

/**
 * Builder returned by IProxyEventRegistry.onPush() / .onPull().
 * Methods return `this` to allow chaining multiple phase handlers.
 */
export interface IActionEventHandler {
  onStarted(handler: ActionEventCallback): IActionEventHandler;
  onCompleted(handler: ActionEventCallback): IActionEventHandler;
  onPendingReview(handler: ActionEventCallback): IActionEventHandler;
  onError(handler: ActionErrorEventCallback): IActionEventHandler;
  onPermissionDenied(handler: ActionEventCallback): IActionEventHandler;
}

/**
 * Registry through which integrations subscribe to git-proxy lifecycle events.
 *
 * Handlers are observers only - they cannot block, modify, or reject git
 * operations; for blocking/policy logic, write a chain plugin instead.
 *
 * See the Event Handlers guide (website/docs/development/event-handlers.mdx)
 * for the execution model and guidance on choosing an event handler over a
 * plugin.
 */
export interface IProxyEventRegistry {
  onPush(): IActionEventHandler;
  /**
   * Subscribes to git-upload-pack operations (fetch / clone / pull).
   * git-proxy does not distinguish these three at the protocol level.
   */
  onPull(): IActionEventHandler;
}
