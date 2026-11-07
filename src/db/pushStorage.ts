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

import { isEqual } from 'lodash';
import { Action } from '../proxy/actions';
import { toClass } from './helper';

// Internal storage markers that may exist on persisted records but must never
// reach callers of the database layer.
type StoredPush = Action & { _lastStepIndex?: number; _activity?: unknown };

/**
 * Prepares a push for storage. Works on a shallow copy, so the caller's Action
 * is not modified. Any internal markers already on the input are dropped
 * first. When `lastStep` is identical to the final entry in `steps`, the
 * duplicate copy is replaced with `_lastStepIndex`, a reference to that entry.
 * A `lastStep` that differs from the final step is stored as-is.
 */
export const compactPush = (action: Action) => {
  const stored: Partial<StoredPush> = { ...action };
  delete stored._lastStepIndex;
  delete stored._activity;
  const index = action.steps?.length - 1;
  if (action.lastStep && index >= 0 && isEqual(action.lastStep, action.steps[index])) {
    stored._lastStepIndex = index;
    delete stored.lastStep;
  }
  return stored;
};

/**
 * Reverses compactPush when reading a stored record back into an Action. If
 * the record holds a valid `_lastStepIndex` and no `lastStep`, `lastStep` is
 * rebuilt from that entry in `steps`. Records that store `lastStep` directly
 * (a distinct last step, or historical records) keep it as stored. Internal
 * markers are always removed from the returned Action.
 */
export const restorePush = (doc: unknown): Action => {
  const action: StoredPush = toClass(doc, Action.prototype);
  const index = action._lastStepIndex;
  if (index !== undefined && Number.isInteger(index) && index >= 0 && !action.lastStep) {
    action.lastStep = action.steps?.[index];
  }
  delete action._lastStepIndex;
  delete action._activity;
  return action;
};
