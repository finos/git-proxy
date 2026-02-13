/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

import { exec } from '../../src/proxy/processors/push-action/blockForAuth';
import { Step, Action } from '../../src/proxy/actions';
import * as urls from '../../src/service/urls';

describe('blockForAuth.exec', () => {
  let mockAction: Action;
  let mockReq: any;

  beforeEach(() => {
    // create a fake Action with spies
    mockAction = {
      id: 'action-123',
      addStep: vi.fn(),
    } as unknown as Action;

    mockReq = { some: 'req' };

    // mock getServiceUIURL
    vi.spyOn(urls, 'getServiceUIURL').mockReturnValue('http://mocked-service-ui');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a Step and add it to the action', async () => {
    const result = await exec(mockReq, mockAction);

    expect(urls.getServiceUIURL).toHaveBeenCalledWith(mockReq);
    expect(mockAction.addStep).toHaveBeenCalledTimes(1);

    const stepArg = (mockAction.addStep as any).mock.calls[0][0];
    expect(stepArg).toBeInstanceOf(Step);
    expect(stepArg.stepName).toBe('authBlock');

    expect(result).toBe(mockAction);
  });

  it('should set the async block message with the correct format', async () => {
    await exec(mockReq, mockAction);

    const stepArg = (mockAction.addStep as any).mock.calls[0][0];
    const blockMessage = (stepArg as Step).blockedMessage;

    expect(blockMessage).toContain('GitProxy has received your push ✅');
    expect(blockMessage).toContain('🔗 Shareable Link');
    expect(blockMessage).toContain('http://mocked-service-ui/dashboard/push/action-123');

    // check color codes are included
    expect(blockMessage).includes('\x1B[32m');
    expect(blockMessage).includes('\x1B[34m');
  });

  it('should set exec.displayName properly', () => {
    expect(exec.displayName).toBe('blockForAuth.exec');
  });

  describe('fuzzing', () => {
    it('should not crash on random req', () => {
      fc.assert(
        fc.property(fc.anything(), (req) => {
          exec(req, mockAction);
        }),
        { numRuns: 1000 },
      );
    });
  });
});
