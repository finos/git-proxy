const chai = require('chai');
const sinon = require('sinon');
const repoModule = require('../../../src/db/mongo/repo');

const { expect } = chai;

describe('mongo repo', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('isUserPushAllowed', () => {
    it('returns true if user is in canPush', async () => {
      sinon.stub(repoModule, 'getRepo').resolves({
        users: {
          canPush: ['alice'],
          canAuthorise: [],
        },
      });
      const result = await repoModule.isUserPushAllowed('myrepo', 'alice');
      expect(result).to.be.true;
    });

    it('returns true if user is in canAuthorise', async () => {
      sinon.stub(repoModule, 'getRepo').resolves({
        users: {
          canPush: [],
          canAuthorise: ['bob'],
        },
      });
      const result = await repoModule.isUserPushAllowed('myrepo', 'bob');
      expect(result).to.be.true;
    });

    it('returns false if user is in neither', async () => {
      sinon.stub(repoModule, 'getRepo').resolves({
        users: {
          canPush: [],
          canAuthorise: [],
        },
      });
      const result = await repoModule.isUserPushAllowed('myrepo', 'charlie');
      expect(result).to.be.false;
    });

    it('returns false if repo is not registered', async () => {
      sinon.stub(repoModule, 'getRepo').resolves(null);
      const result = await repoModule.isUserPushAllowed('myrepo', 'charlie');
      expect(result).to.be.false;
    });
  });
});
