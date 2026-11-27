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

import { EventHandlerPlugin } from '../EventHandlerPlugin';
import { ActionPhase, EventDetails, IProxyEventRegistry, ProxyOperation } from '../types';

const formatLine = (details: EventDetails): string => {
  const payload: Record<string, unknown> = {
    event: 'gitproxy.action',
    actionId: details.actionId,
    operation: details.operation,
    phase: details.phase,
    timestamp: new Date(details.timestamp).toISOString(),
    repo: details.repository.url,
  };
  if (details.user?.username) payload.username = details.user.username;
  if (details.user?.email) payload.userEmail = details.user.email;
  if (details.error) payload.error = details.error.message;
  return JSON.stringify(payload);
};

const log = (details: EventDetails): void => {
  console.info(formatLine(details));
};

const phases: ActionPhase[] = [
  'started',
  'completed',
  'pendingReview',
  'error',
  'permissionDenied',
];
const operations: ProxyOperation[] = ['push', 'pull'];

/**
 * Built-in event handler that emits a structured JSON line for every
 * lifecycle event. Always loaded so deployments get an automatic audit trail
 * without needing to write or configure a handler. To silence, filter at the
 * log aggregator on `"event":"gitproxy.action"`.
 */
export const consoleLoggerEventHandler = new EventHandlerPlugin(function registerConsoleLogger(
  registry: IProxyEventRegistry,
) {
  for (const op of operations) {
    const builder = op === 'push' ? registry.onPush() : registry.onPull();
    for (const phase of phases) {
      if (phase === 'started') builder.onStarted(log);
      else if (phase === 'completed') builder.onCompleted(log);
      else if (phase === 'pendingReview') builder.onPendingReview(log);
      else if (phase === 'error') builder.onError(log);
      else if (phase === 'permissionDenied') builder.onPermissionDenied(log);
      else {
        const exhaustiveCheck: never = phase;
        throw new Error(`Unhandled ActionPhase in consoleLogger: ${exhaustiveCheck}`);
      }
    }
  }
});
