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

    const checkUserPushPermission = proxyquire(
      '../../src/proxy/processors/push-action/checkUserPushPermission',
      {
        '../../../db': {
          getUsers: getUsersStub,
          isUserPushAllowed: isUserPushAllowedStub,
        },
      },
    );

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
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
      action.user = 'git-user';
      action.userEmail = 'db-user@test.com';
      stepSpy = sinon.spy(Step.prototype, 'log');
    });

    it('should allow push when user has permission', async () => {
      getUsersStub.resolves([
        { username: 'db-user', email: 'db-user@test.com', gitAccount: 'git-user' },
      ]);
      isUserPushAllowedStub.resolves(true);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(stepSpy.lastCall.args[0]).to.equal(
        'User db-user@test.com is allowed to push on repo test/repo.git',
      );
      expect(logStub.lastCall.args[0]).to.equal(
        'User db-user@test.com permission on Repo repo : true',
      );
    });

    it('should reject push when user has no permission', async () => {
      getUsersStub.resolves([
        { username: 'db-user', email: 'db-user@test.com', gitAccount: 'git-user' },
      ]);
      isUserPushAllowedStub.resolves(false);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.equal(
        'Your push has been blocked (db-user@test.com is not allowed to push on repo test/repo.git)',
      );
    });

    it('should reject push when no user found for git account', async () => {
      getUsersStub.resolves([]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Your push has been blocked');
    });

    it('should handle multiple users for git account by rejecting the push', async () => {
      getUsersStub.resolves([
        { username: 'user1', email: 'db-user@test.com', gitAccount: 'git-user' },
        { username: 'user2', email: 'db-user@test.com', gitAccount: 'git-user' },
      ]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.equal(
        'Your push has been blocked (there are multiple users with email db-user@test.com)',
      );
    });

    it('should return error when no user is set in the action', async () => {
      action.user = null;
      action.userEmail = null;
      getUsersStub.resolves([]);
      const result = await exec(req, action);
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.include(
        'Push blocked: User not found. Please contact an administrator for support.',
      );
    });
  });
});
