const { exec } = require('../src/proxy/processors/push-action/checkForAiMlUsage.js');
const sinon = require('sinon');
const { Action } = require('../src/proxy/actions/Action.js');
const { Step } = require('../src/proxy/actions/Step.js');


describe('Detect AI/ML usage from git diff', () => {
  let logStub;

  beforeEach(() => {
    // Stub console.log and config.getCommitConfig for isolation in each test case
    logStub = sinon.stub(console, 'log');
  });

  afterEach(() => {
    // Restore stubs to avoid cross-test interference
    logStub.restore();
    // configStub.restore();
  });

  const createDiffContent = (filePaths) => {
    // Creates diff-like content for each file path to simulate actual git diff output
    return filePaths.map((filePath) => `diff --git a/${filePath} b/${filePath}`).join('\n');
  };

  it('Block push if AI/ML file extensions detected', async () => {
    // Create action and step instances with test data that should trigger blocking
    const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
    const step = new Step('diff');

    const filePaths = [
      'test/test_data/ai_test_data/model.h5',
      'test/test_data/ai_test_data/dataset.csv',
    ];
    step.setContent(createDiffContent(filePaths));
    action.addStep(step);

    await exec(null, action);

    // Check that console.log was called with the blocking message
    sinon.assert.calledWith(
      logStub,
      sinon.match(
        /Your push has been blocked due to AI\/ML usage detection/,
      ),
    );
  });

  it('Block push if AI/ML file content detected', async () => {
    // Create action and step instances with test data that should trigger blocking
    const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
    const step = new Step('diff');

    const filePaths = [
      'test/test_data/ai_test_data/ai_script.py',
      'test/test_data/ai_test_data/ai_config.json',
    ];
    step.setContent(createDiffContent(filePaths));
    action.addStep(step);

    await exec(null, action);

    // Check that console.log was called with the blocking message
    sinon.assert.calledWith(
      logStub,
      sinon.match(
        /Your push has been blocked due to AI\/ML usage detection/,
      ),
    );
  });

  it('Allow push if no AI/ML usage is detected', async () => {
    // Configure with no sensitive EXIF parameters

    const action = new Action('action_id', 'push', 'create', Date.now(), 'owner/repo');
    const step = new Step('diff');

    const filePaths = ['test/test_data/ai_test_data/non_ai_script.py'];
    step.setContent(createDiffContent(filePaths));
    action.addStep(step);

    await exec(null, action);

    // Ensure no blocking message was logged
    sinon.assert.neverCalledWith(
      logStub,
      sinon.match(
        /Your push has been blocked due to AI\/ML usage detection/,
      ),
    );
  });
});
