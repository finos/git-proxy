const { expect } = require('chai');
const sinon = require('sinon');
const db = require('../src/db');
const { Step } = require('../src/proxy/actions');
const { exec } = require('../src/proxy/processors/push-action/checkUserPushPermission');

describe('checkUserPushPermission.exec', () => {
  let req;
  let action;

  beforeEach(() => {
    req = {}
    action = {
      repo: 'owner/repo.git',
      user: 'test123',
      addStep: sinon.stub(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should allow user to push if user is associated with the Git account and has permission', async () => {
    const getUsersStub = sinon.stub(db, 'getUsers').resolves([{ username: 'test123' }]);
    const isUserPushAllowedStub = sinon.stub(db, 'isUserPushAllowed').resolves(true);
    const stepLogStub = sinon.stub(Step.prototype, 'log');

    const result = await exec(req, action);

    expect(getUsersStub.calledOnceWithExactly({ gitAccount: 'test123' })).to.be.true;
    expect(isUserPushAllowedStub.calledOnceWithExactly('repo', 'test123')).to.be.true;
    expect(stepLogStub.calledOnceWithExactly('User test123 is allowed to push on repo owner/repo.git')).to.be.true;
    expect(action.addStep.calledOnceWithExactly(sinon.match.instanceOf(Step))).to.be.true;
    expect(result).to.deep.equal(action);
  });

  it('should reject push if user is associated with the Git account but does not have permission', async () => {
    const getUsersStub = sinon.stub(db, 'getUsers').resolves([{ username: 'test123' }]);
    const isUserPushAllowedStub = sinon.stub(db, 'isUserPushAllowed').resolves(false);
    const stepLogStub = sinon.stub(Step.prototype, 'log');
    const stepSetErrorStub = sinon.stub(Step.prototype, 'setError');

    const result = await exec(req, action);

    expect(getUsersStub.calledOnceWithExactly({ gitAccount: 'test123' })).to.be.true;
    expect(isUserPushAllowedStub.calledOnceWithExactly('repo', 'test123')).to.be.true;
    expect(stepLogStub.calledOnceWithExactly('User test123 is not allowed to push on repo owner/repo.git, ending')).to.be.true;
    expect(stepSetErrorStub.calledOnceWithExactly('Rejecting push as user test123 is not allowed to push on repo owner/repo.git')).to.be.true;
    expect(action.addStep.calledOnceWithExactly(sinon.match.instanceOf(Step))).to.be.true;
    expect(result).to.deep.equal(action);
  });

  it('should reject push if user is not associated with the Git account', async () => {
    const getUsersStub = sinon.stub(db, 'getUsers').resolves([]);
    const isUserPushAllowedStub = sinon.stub(db, 'isUserPushAllowed').resolves(false);
    const stepLogStub = sinon.stub(Step.prototype, 'log');
    const stepSetErrorStub = sinon.stub(Step.prototype, 'setError');

    const result = await exec(req, action);

    expect(getUsersStub.calledOnceWithExactly({ gitAccount: 'test123' })).to.be.true;
    expect(isUserPushAllowedStub.notCalled).to.be.true;
    expect(stepLogStub.calledOnceWithExactly('User test123 is not allowed to push on repo owner/repo.git, ending')).to.be.true;
    expect(stepSetErrorStub.calledOnceWithExactly('Rejecting push as user test123 is not allowed to push on repo owner/repo.git')).to.be.true;
    expect(action.addStep.calledOnceWithExactly(sinon.match.instanceOf(Step))).to.be.true;
    expect(result).to.deep.equal(action);
  });
});
