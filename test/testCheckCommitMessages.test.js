const { expect } = require('chai');
const sinon = require('sinon');
const { exec } = require('../src/proxy/processors/push-action/checkCommitMessages');
const config = require('../src/config');

describe('exec', () => {
  let action;
  let consoleLogStub;

  beforeEach(() => {
    action = {
      commitData: [],
      steps: [],
      addStep: function (step) {
        this.steps = this.steps || [];
        this.steps.push(step);
      },
    };

    // Mock console.log
    consoleLogStub = sinon.stub(console, 'log');

    // Mock commitConfig
    sinon.stub(config, 'getCommitConfig').returns({
      literals: ['blocked', 'forbidden'],
      patterns: ['blocked pattern', 'forbidden pattern'],
    });
  });

  afterEach(() => {
    consoleLogStub.restore();
    config.getCommitConfig.restore();
  });

  it('should return false if commit message is empty', async () => {
    action.commitData = [{ message: '' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.true;
  });

  it('should return false if commit message is not a string', async () => {
    action.commitData = [{ message: 12345 }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.true;
  });

  it('should return false if commit message contains blocked literals', async () => {
    action.commitData = [{ message: 'This commit is blocked' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should return false if commit message matches blocked patterns', async () => {
    action.commitData = [{ message: 'This message contains a blocked pattern' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should return false if commit message contains a forbidden literal', async () => {
    action.commitData = [{ message: 'This commit is forbidden' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should return false if commit message matches a forbidden pattern', async () => {
    action.commitData = [{ message: 'This commit contains a forbidden pattern' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should handle mixed valid and invalid commit messages', async () => {
    action.commitData = [
      { message: 'This is a valid commit message' },
      { message: 'This commit is blocked' },
    ];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should return true if all commit messages are valid', async () => {
    action.commitData = [{ message: 'Valid commit message' }];
    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.false;
  });

  it('should log the request and action', async () => {
    action.commitData = [{ message: 'Valid commit message' }];
    const req = { some: 'request' };
    await exec(req, action);
    expect(consoleLogStub.calledWith({ req, action })).to.be.true;
  });
});
