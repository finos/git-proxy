const { expect } = require('chai');
const sinon = require('sinon');
const { Step } = require('../src/proxy/actions');
const { getServiceUIURL } = require('../src/service/urls');
const { exec } = require('../src/proxy/processors/push-action/blockForAuth');

describe('exec', () => {
  let req;
  let action;
  let actionAddStepSpy;

  beforeEach(() => {
    req = {
      protocol: 'http',
      headers: {
        host: 'localhost:3000',
      },
    }; // Mock request object

    action = {
      id: '123',
      addStep: sinon.spy(),
    }; // Mock action object

    actionAddStepSpy = action.addStep; // Assign the spy directly
  });

  it('should add a step with the correct message', async () => {
    const url = getServiceUIURL(req);
    const expectedMessage =
      '\n\n\n' +
      `\x1B[32mGitProxy has received your push ✅\x1B[0m\n\n` +
      '🔗 Shareable Link\n\n' +
      `\x1B[34m${url}/admin/push/${action.id}\x1B[0m` +
      '\n\n\n';

    await exec(req, action);

    expect(actionAddStepSpy.calledOnce).to.be.true;
    expect(actionAddStepSpy.firstCall.args[0]).to.be.instanceof(Step);
    expect(actionAddStepSpy.firstCall.args[0].stepName).to.equal('authBlock');
    expect(actionAddStepSpy.firstCall.args[0].blockedMessage).to.equal(expectedMessage);
  });
});
