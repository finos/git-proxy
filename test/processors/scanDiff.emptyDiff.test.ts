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

import { describe, it, expect } from 'vitest';
import { Action, Step } from '../../src/proxy/actions';
import { exec } from '../../src/proxy/processors/push-action/scanDiff';
import { generateDiffStep } from './scanDiff.test';

describe('scanDiff - Empty Diff Handling', () => {
  describe('Empty diff scenarios', () => {
    it('should allow empty diff (legitimate empty push)', async () => {
      const action = new Action('empty-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with empty content
      const diffStep = generateDiffStep('');
      action.steps = [diffStep as Step];

      const result = await exec({}, action);

      expect(result.steps.length).toBe(2); // diff step + scanDiff step
      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });

    it('should allow null diff', async () => {
      const action = new Action('null-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with null content
      const diffStep = generateDiffStep(null);
      action.steps = [diffStep as Step];

      const result = await exec({}, action);

      expect(result.steps.length).toBe(2);
      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });

    it('should allow undefined diff', async () => {
      const action = new Action('undefined-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with undefined content
      const diffStep = generateDiffStep(undefined);
      action.steps = [diffStep as Step];

      const result = await exec({}, action);

      expect(result.steps.length).toBe(2);
      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });
  });

  describe('Normal diff processing', () => {
    it('should process valid diff content without blocking', async () => {
      const action = new Action('valid-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');
      action.project = 'test-org';

      // Simulate normal diff content
      const normalDiff = `diff --git a/config.js b/config.js
index 1234567..abcdefg 100644
--- a/config.js
+++ b/config.js
@@ -1,3 +1,4 @@
 module.exports = {
+ newFeature: true,
 database: "production"
 };`;

      const diffStep = generateDiffStep(normalDiff);
      action.steps = [diffStep as Step];

      const result = await exec({}, action);

      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });
  });

  describe('Error conditions', () => {
    it('should handle non-string diff content', async () => {
      const action = new Action('non-string-test', 'push', 'POST', Date.now(), 'test/repo.git');
      const diffStep = generateDiffStep(12345 as any);
      action.steps = [diffStep as Step];

      const result = await exec({}, action);

      expect(result.steps[1].error).toBe(true);
      expect(result.steps[1].errorMessage).toContain('non-string value');
    });
  });
});
