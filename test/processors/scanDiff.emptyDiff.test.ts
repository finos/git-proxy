import { describe, it, expect } from 'vitest';
import { Request } from 'express';

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

      const result = await exec({} as Request, action);

      expect(result.steps.length).toBe(2); // diff step + scanDiff step
      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });

    it('should allow null diff', async () => {
      const action = new Action('null-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with null content
      const diffStep = generateDiffStep(null);
      action.steps = [diffStep as Step];

      const result = await exec({} as Request, action);

      expect(result.steps.length).toBe(2);
      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });

    it('should allow undefined diff', async () => {
      const action = new Action('undefined-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with undefined content
      const diffStep = generateDiffStep(undefined);
      action.steps = [diffStep as Step];

      const result = await exec({} as Request, action);

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

      const result = await exec({} as Request, action);

      expect(result.steps[1].error).toBe(false);
      expect(result.steps[1].errorMessage).toBeNull();
    });
  });

  describe('Error conditions', () => {
    it('should handle non-string diff content', async () => {
      const action = new Action('non-string-test', 'push', 'POST', Date.now(), 'test/repo.git');
      const diffStep = generateDiffStep(12345 as unknown as string);
      action.steps = [diffStep as Step];

      const result = await exec({} as Request, action);

      expect(result.steps[1].error).toBe(true);
      expect(result.steps[1].errorMessage).toContain('non-string value');
    });
  });
});
