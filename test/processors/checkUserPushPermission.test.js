const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('checkUserPushPermission', () => {
  let exec;
  let getUsersStub;
  let getRepoByUrl;

  beforeEach(() => {
    getUsersStub = sinon.stub();
    getRepoByUrl = sinon.stub();

    const checkUserPushPermission = proxyquire('../../src/proxy/processors/push-action/checkUserPushPermission', {
      '../../../db': {
        getUsers: getUsersStub,
        getRepoByUrl: getRepoByUrl
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

    beforeEach(() => {
      req = {};
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo.git'
      );
      action.user = 'a-git-user';
    });

    it('should allow push when user has permission', async () => {
      getRepoByUrl.resolves({
        name: 'repo',
        project: 'test',
        url: 'test/repo.git',
        users: {
          canPush: ['a-user'], canAuthorise: ['zohar']
        }
      });

      getUsersStub.resolves([{ username: 'a-user', gitAccount: 'a-git-user' }]);

      const result = await exec(req, action);

      expect(result.error).to.be.false;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(result.steps[0].logs[0]).to.eq('checkUserPushPermission - User a-user is allowed to push on repo test/repo.git');
    });

    it('should reject push when user has no permission', async () => {
      getRepoByUrl.resolves({
        name: 'repo',
        project: 'test',
        url: 'test/repo.git',
        users: {
          canPush: ['diff-user'], canAuthorise: ['zohar']
        }
      });

      getUsersStub.resolves([{ username: 'a-user', gitAccount: 'a-git-user' }]);

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.equal('Rejecting push as user a-git-user is not allowed to push on repo test/repo.git');
      expect(result.steps[0].logs[0]).to.eq('checkUserPushPermission - User a-user is not allowed to push on repo test/repo.git, ending');
    });

    it('should reject push when no user found for git account', async () => {
      getRepoByUrl.resolves({
        name: 'repo',
        project: 'test',
        url: 'test/repo.git',
        users: {
          canPush: ['diff-user'], canAuthorise: ['zohar']
        }
      });

      getUsersStub.resolves([]);

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.equal('Rejecting push as user a-git-user is not allowed to push on repo test/repo.git');
    });

    it('should handle multiple users for git account by rejecting push', async () => {
      getRepoByUrl.resolves({
        name: 'repo',
        project: 'test',
        url: 'test/repo.git',
        users: {
          canPush: ['diff-user'], canAuthorise: ['zohar']
        }
      });

      getUsersStub.resolves([
        { username: 'user1', gitAccount: 'git-user' },
        { username: 'user2', gitAccount: 'git-user' }
      ]);

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps[0].error).to.be.true;
      expect(result.steps[0].errorMessage).to.equal('Rejecting push as user a-git-user is not allowed to push on repo test/repo.git');
    });
  });
});
