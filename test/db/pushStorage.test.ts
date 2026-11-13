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

import { describe, expect, it } from 'vitest';
import { Action, RequestType, Step } from '../../src/proxy/actions';
import { compactPush, restorePush } from '../../src/db/pushStorage';

const makePush = () =>
  new Action('compact', RequestType.PUSH, 'POST', 1, 'https://example.com/a/b');

describe('push storage representation', () => {
  it('stores a repeated last step once and restores the detail API shape', () => {
    const action = makePush();
    const step = new Step('diff');
    step.content = 'unique diff payload';
    step.logs = ['Generated diff'];
    action.addStep(step);

    const stored = compactPush(action);
    expect(JSON.stringify(stored).match(/unique diff payload/g)).toHaveLength(1);
    expect(stored).not.toHaveProperty('lastStep');
    expect(action.lastStep).toBe(step);
    expect(action).not.toHaveProperty('_lastStepIndex');

    const restored = restorePush(Object.assign(makePush(), JSON.parse(JSON.stringify(stored))));
    expect(restored).toEqual(action);
    expect(restored.getLastStep()).toBe(restored.steps[0]);
    expect(restored).not.toHaveProperty('_lastStepIndex');
    expect(compactPush(restored)).toEqual(stored);
  });

  it('compacts structurally equal steps read back from a legacy document', () => {
    const action = makePush();
    action.addStep(new Step('diff'));
    const legacy = JSON.parse(JSON.stringify(action));
    expect(compactPush(legacy)).not.toHaveProperty('lastStep');
  });

  it('preserves a last step containing information absent from the steps array', () => {
    const action = makePush();
    action.addStep(new Step('diff'));
    action.lastStep = Object.assign(new Step('diff'), action.steps[0], {
      logs: ['additional diagnostic'],
    });
    expect(compactPush(action).lastStep).toEqual(action.lastStep);
    expect(restorePush(action)).toEqual(action);
  });

  it('preserves a legacy missing lastStep and empty steps', () => {
    const action = makePush();
    expect(restorePush(action)).not.toHaveProperty('lastStep');
    action.addStep(new Step('diff'));
    delete action.lastStep;
    expect(compactPush(action)).not.toHaveProperty('_lastStepIndex');
    expect(restorePush(action)).not.toHaveProperty('lastStep');
  });

  it.each([-1, 0.5, 999])('does not fabricate a step for an invalid index %s', (index) => {
    const action = makePush();
    const restored = restorePush(Object.assign(action, { _lastStepIndex: index }));
    expect(restored.lastStep).toBeUndefined();
    expect(restored).not.toHaveProperty('_lastStepIndex');
  });
});
