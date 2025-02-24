const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const { exec } = require('../../src/proxy/processors/push-action/preReceive');

describe('Pre-Receive Hook Execution', function () {
  let action;
  let req;

  beforeEach(() => {
    req = {};
    action = {
      steps: [],
      commitFrom: 'oldCommitHash',
      commitTo: 'newCommitHash',
      branch: 'feature-branch',
      proxyGitPath: 'test/preReceive/mock/repo',
      repoName: 'test-repo',
      addStep: function (step) {
        this.steps.push(step);
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should execute hook successfully', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-allow.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(
      result.steps[0].logs.some((log) => log.includes('Pre-receive hook executed successfully')),
    ).to.be.true;
  });

  it('should fail when hook file does not exist', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/missing-hook.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.true;
    expect(
      result.steps[0].logs.some((log) => log.includes('Hook execution error: Hook file not found')),
    ).to.be.true;
  });

  it('should fail when hook execution returns an error', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-reject.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);

    const step = result.steps[0];

    expect(step.error).to.be.true;
    expect(step.logs.some((log) => log.includes('Hook stderr:'))).to.be.true;

    expect(step.errorMessage).to.exist;

    expect(action.steps).to.deep.include(step);
  });
});
