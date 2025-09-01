const chai = require('chai');
const sinon = require('sinon');
const db = require('../../src/db');

const { expect } = chai;

describe('db', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('isUserPushAllowed', () => {
    it('returns true if user is in canPush', async () => {
      sinon.stub(db, 'getRepoByUrl').resolves({
        users: {
          canPush: ['alice'],
          canAuthorise: [],
        },
      });
      const result = await db.isUserPushAllowed('myrepo', 'alice');
      expect(result).to.be.true;
    });

    it('returns true if user is in canAuthorise', async () => {
      sinon.stub(db, 'getRepoByUrl').resolves({
        users: {
          canPush: [],
          canAuthorise: ['bob'],
        },
      });
      const result = await db.isUserPushAllowed('myrepo', 'bob');
      expect(result).to.be.true;
    });

    it('returns false if user is in neither', async () => {
      sinon.stub(db, 'getRepoByUrl').resolves({
        users: {
          canPush: [],
          canAuthorise: [],
        },
      });
      const result = await db.isUserPushAllowed('myrepo', 'charlie');
      expect(result).to.be.false;
    });

    it('returns false if repo is not registered', async () => {
      sinon.stub(db, 'getRepoByUrl').resolves(null);
      const result = await db.isUserPushAllowed('myrepo', 'charlie');
      expect(result).to.be.false;
    });
  });
});
