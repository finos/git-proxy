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
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'https://github.com/finos/git-proxy.git',
      );
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
      expect(
        stepSpy.calledWith(
          'User db-user is allowed to push on repo https://github.com/finos/git-proxy.git',
        ),
      ).to.be.true;
      expect(logStub.lastCall.args[0]).to.equal(
        'User db-user permission on Repo https://github.com/finos/git-proxy.git : true',
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
      expect(
        stepSpy.calledWith(
          'User db-user is not allowed to push on repo https://github.com/finos/git-proxy.git, ending',
        ),
      ).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Rejecting push as user git-user');
      expect(logStub.lastCall.args[0]).to.equal('User not allowed to Push');
    });

    it('should reject push when no user found for git account', async () => {
      getUsersStub.resolves([]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(
        stepSpy.calledWith(
          'User git-user is not allowed to push on repo https://github.com/finos/git-proxy.git, ending',
        ),
      ).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Rejecting push as user git-user');
    });

    it('should handle multiple users for git account by rejecting the push', async () => {
      getUsersStub.resolves([
        { username: 'user1', email: 'db-user@test.com', gitAccount: 'git-user' },
        { username: 'user2', email: 'db-user@test.com', gitAccount: 'git-user' },
      ]);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(logStub.getCall(-3).args[0]).to.equal(
        'Users for this git account: [{"username":"user1","gitAccount":"git-user"},{"username":"user2","gitAccount":"git-user"}]',
      );
      expect(logStub.getCall(-2).args[0]).to.equal(
        'User git-user permission on Repo https://github.com/finos/git-proxy.git : false',
      );
      expect(logStub.lastCall.args[0]).to.equal('User not allowed to Push');
    });
  });
});
