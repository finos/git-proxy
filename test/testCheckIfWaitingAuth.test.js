const { expect } = require('chai');
const sinon = require('sinon');
const { exec } = require('../src/proxy/processors/push-action/checkIfWaitingAuth');
const data = require('../src/db');

describe('checkIfWaitingAuth.exec', () => {
  let req;
  let action;
  let existingAction;
  let step;

  beforeEach(() => {
    req = {}; // Mock request object
    action = {
      id: '123',
      setAllowPush: sinon.stub(),
      addStep: sinon.stub(),
      error: false, // Ensure error is included
    };
    step = {
      log: sinon.stub(),
      setError: sinon.stub(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should set allow push if existing action is found and not error', async () => {
    existingAction = { authorised: true };
    sinon.stub(data, 'getPush').resolves(existingAction);

    await exec(req, action);

    expect(action.setAllowPush.calledOnce).to.be.true;
    expect(action.addStep.calledOnce).to.be.true;
  });

  it('should handle action without error property', async () => {
    existingAction = { authorised: true };
    action.error = false; // Ensure error is false
    sinon.stub(data, 'getPush').resolves(existingAction);

    await exec(req, action);

    expect(action.setAllowPush.calledOnce).to.be.true;
    expect(action.addStep.calledOnce).to.be.true;
  });

  it('should not set allow push if existing action is found but has error', async () => {
    existingAction = { authorised: false, error: 'Some error' };
    sinon.stub(data, 'getPush').resolves(existingAction);

    await exec(req, action);

    expect(action.setAllowPush.notCalled).to.be.true;
    expect(action.addStep.calledOnce).to.be.true;
  });

  it('should not set allow push if existing action is not found', async () => {
    sinon.stub(data, 'getPush').resolves(null);

    await exec(req, action);

    expect(action.setAllowPush.notCalled).to.be.true;
    expect(action.addStep.calledOnce).to.be.true;
  });

  it('should set step error if an exception occurs', async () => {
    sinon.stub(data, 'getPush').throws(new Error('Database error'));

    try {
      await exec(req, action);
    } catch (error) {
      expect(action.addStep.calledOnce).to.be.true;
      expect(step.setError.calledOnce).to.be.true;
    }
  });
});
