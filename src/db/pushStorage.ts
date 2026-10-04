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

type StoredPush = Action & { _lastStepIndex?: number };

export const compactPush = (action: Action) => {
  const stored: Partial<StoredPush> = { ...action };
  delete stored._lastStepIndex;
  const index = action.steps?.length - 1;
  if (action.lastStep && index >= 0 && isEqual(action.lastStep, action.steps[index])) {
    stored._lastStepIndex = index;
    delete stored.lastStep;
  }
  return stored;
};

export const restorePush = (doc: unknown): Action => {
  const action: StoredPush = toClass(doc, Action.prototype);
  const index = action._lastStepIndex;
  if (index !== undefined && Number.isInteger(index) && index >= 0 && !action.lastStep) {
    action.lastStep = action.steps?.[index];
  }
  delete action._lastStepIndex;
  return action;
};
