const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action, Step } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('checkUserPushPermission', () => {
  let exec;
  let getUsersStub;
  let isUserPushAllowedStub;
  let logStub;

  beforeEach(() => {
    logStub = sinon.stub(console, 'log');

    getUsersStub = sinon.stub();
    isUserPushAllowedStub = sinon.stub();

    const checkUserPushPermission = proxyquire('../../src/proxy/processors/push-action/checkUserPushPermission', {
      '../../../db': {
        getUsers: getUsersStub,
        isUserPushAllowed: isUserPushAllowedStub
      }
    });

    exec = checkUserPushPermission.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    let action;
    let req;
    let stepSpy;

    beforeEach(() => {
      req = {};
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git'
      );
      action.user = 'git-user';
      stepSpy = sinon.spy(Step.prototype, 'log');
    });

    it('should allow push when user has permission', async () => {
      getUsersStub.resolves([{ username: 'db-user', gitAccount: 'git-user' }]);
      isUserPushAllowedStub.resolves(true);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(stepSpy.calledWith('User db-user is allowed to push on repo test/repo.git')).to.be.true;
      expect(logStub.calledWith('User db-user permission on Repo repo : true')).to.be.true;
    });

    it('should reject push when user has no permission', async () => {
      getUsersStub.resolves([{ username: 'db-user', gitAccount: 'git-user' }]);
      isUserPushAllowedStub.resolves(false);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith('User db-user is not allowed to push on repo test/repo.git, ending')).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Rejecting push as user git-user');
      expect(logStub.calledWith('User not allowed to Push')).to.be.true;
    });

    it('should reject push when no user found for git account', async () => {
      getUsersStub.resolves([]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith('User git-user is not allowed to push on repo test/repo.git, ending')).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Rejecting push as user git-user');
    });

    it('should handle multiple users for git account by rejecting push', async () => {
      getUsersStub.resolves([
        { username: 'user1', gitAccount: 'git-user' },
        { username: 'user2', gitAccount: 'git-user' }
      ]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(logStub.calledWith('Users for this git account: [{"username":"user1","gitAccount":"git-user"},{"username":"user2","gitAccount":"git-user"}]')).to.be.true;
    });

    it('should return error when no user is set in the action', async () => {
      action.user = null;
      const result = await exec(req, action);
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Push blocked: User not found. Please contact an administrator for support.');
    });
  });
});
