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
      setAutoApproval: sinon.stub(),
      setAutoRejection: sinon.stub(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should skip execution when hook file does not exist', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/missing-hook.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(
      result.steps[0].logs.some((log) =>
        log.includes('Pre-receive hook not found, skipping execution.'),
      ),
    ).to.be.true;
    expect(action.setAutoApproval.called).to.be.false;
    expect(action.setAutoRejection.called).to.be.false;
  });

  it('should skip execution when hook directory does not exist', async () => {
    const scriptPath = path.resolve(__dirname, 'non-existent-directory/pre-receive.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(
      result.steps[0].logs.some((log) =>
        log.includes('Pre-receive hook not found, skipping execution.'),
      ),
    ).to.be.true;
    expect(action.setAutoApproval.called).to.be.false;
    expect(action.setAutoRejection.called).to.be.false;
  });

  it('should catch and handle unexpected errors', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-0.sh');

    sinon.stub(require('fs'), 'existsSync').throws(new Error('Unexpected FS error'));

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.true;
    expect(
      result.steps[0].logs.some((log) => log.includes('Hook execution error: Unexpected FS error')),
    ).to.be.true;
    expect(action.setAutoApproval.called).to.be.false;
    expect(action.setAutoRejection.called).to.be.false;
  });

  it('should approve push automatically when hook returns status 0', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-0.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(
      result.steps[0].logs.some((log) =>
        log.includes('Push automatically approved by pre-receive hook.'),
      ),
    ).to.be.true;
    expect(action.setAutoApproval.calledOnce).to.be.true;
    expect(action.setAutoRejection.called).to.be.false;
  });

  it('should reject push automatically when hook returns status 1', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-1.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(
      result.steps[0].logs.some((log) =>
        log.includes('Push automatically rejected by pre-receive hook.'),
      ),
    ).to.be.true;
    expect(action.setAutoRejection.calledOnce).to.be.true;
    expect(action.setAutoApproval.called).to.be.false;
  });

  it('should execute hook successfully and require manual approval', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-2.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.false;
    expect(result.steps[0].logs.some((log) => log.includes('Push requires manual approval.'))).to.be
      .true;
    expect(action.setAutoApproval.called).to.be.false;
    expect(action.setAutoRejection.called).to.be.false;
  });

  it('should handle unexpected hook status codes', async () => {
    const scriptPath = path.resolve(__dirname, 'pre-receive-hooks/always-exit-99.sh');

    const result = await exec(req, action, scriptPath);

    expect(result.steps).to.have.lengthOf(1);
    expect(result.steps[0].error).to.be.true;
    expect(result.steps[0].logs.some((log) => log.includes('Unexpected hook status: 99'))).to.be
      .true;
    expect(result.steps[0].logs.some((log) => log.includes('Unknown pre-receive hook error.'))).to
      .be.true;
    expect(action.setAutoApproval.called).to.be.false;
    expect(action.setAutoRejection.called).to.be.false;
  });
});
