const { Action } = require('../../src/proxy/actions');
const { exec } = require('../../src/proxy/processors/push-action/scanDiff');

const chai = require('chai');
const expect = chai.expect;

describe('scanDiff - Empty Diff Handling', () => {
  describe('Empty diff scenarios', () => {
    it('should allow empty diff (legitimate empty push)', async () => {
      const action = new Action('empty-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with empty content
      const diffStep = { stepName: 'diff', content: '', error: false };
      action.steps = [diffStep];

      const result = await exec({}, action);

      expect(result.steps.length).to.equal(2); // diff step + scanDiff step
      expect(result.steps[1].error).to.be.false;
      expect(result.steps[1].errorMessage).to.be.null;
    });

    it('should allow null diff', async () => {
      const action = new Action('null-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with null content
      const diffStep = { stepName: 'diff', content: null, error: false };
      action.steps = [diffStep];

      const result = await exec({}, action);

      expect(result.steps.length).to.equal(2);
      expect(result.steps[1].error).to.be.false;
      expect(result.steps[1].errorMessage).to.be.null;
    });

    it('should allow undefined diff', async () => {
      const action = new Action('undefined-diff-test', 'push', 'POST', Date.now(), 'test/repo.git');

      // Simulate getDiff step with undefined content
      const diffStep = { stepName: 'diff', content: undefined, error: false };
      action.steps = [diffStep];

      const result = await exec({}, action);

      expect(result.steps.length).to.equal(2);
      expect(result.steps[1].error).to.be.false;
      expect(result.steps[1].errorMessage).to.be.null;
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
+  newFeature: true,
   database: "production"
 };`;

      const diffStep = { stepName: 'diff', content: normalDiff, error: false };
      action.steps = [diffStep];

      const result = await exec({}, action);

      expect(result.steps[1].error).to.be.false;
      expect(result.steps[1].errorMessage).to.be.null;
    });
  });

  describe('Error conditions', () => {
    it('should handle non-string diff content', async () => {
      const action = new Action('non-string-test', 'push', 'POST', Date.now(), 'test/repo.git');

      const diffStep = { stepName: 'diff', content: 12345, error: false };
      action.steps = [diffStep];

      const result = await exec({}, action);

      expect(result.steps[1].error).to.be.true;
      expect(result.steps[1].errorMessage).to.include('non-string value');
    });
  });
});
