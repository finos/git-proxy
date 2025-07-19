const { expect } = require('chai');
const sinon = require('sinon');
const repoModule = require('../../../src/db/file/repo');

describe('File DB', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getRepo', () => {
    it('should get the repo using the name', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'http://example.com/sample-repo.git',
      };

      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(null, repoData));

      const result = await repoModule.getRepo('Sample');
      expect(result).to.equal(repoData);
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(null, repoData));

      const result = await repoModule.getRepoByUrl('https://github.com/finos/git-proxy.git');
      expect(result).to.equal(repoData);
    });

    it('should get the repo using the url, stripping off the .git', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(null, repoData));

      const result = await repoModule.getRepoByUrl('https://github.com/finos/git-proxy.git');

      expect(repoModule.db.findOne.calledWith(sinon.match({ url: 'https://github.com/finos/git-proxy.git'}))).to.be.true;
      expect(result).to.equal(repoData);
    });
    
    it('should get the repo using the url, ignoring the case', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };

      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(null, repoData));

      const result = await repoModule.getRepoByUrl('https://github.com/Finos/Git-Proxy.git');
      expect(result).to.equal(repoData);
      expect(repoModule.db.findOne.calledWith(sinon.match({ url: 'https://github.com/finos/git-proxy.git' }))).to.be.true;
    });

    it('should return null if the repo is not found', async () => {
      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(null, null));

      const result = await repoModule.getRepoByUrl('https://github.com/finos/missing-repo.git');
      expect(result).to.be.null;
      expect(repoModule.db.findOne.calledWith(sinon.match({ url: 'https://github.com/finos/missing-repo.git' })),
      ).to.be.true;
    });

    it('should reject if the database returns an error', async () => {
      sandbox.stub(repoModule.db, 'findOne').callsFake((query, cb) => cb(new Error('DB error')));
    
      try {
        await repoModule.getRepoByUrl('https://github.com/finos/git-proxy.git');
        expect.fail('Expected promise to be rejected');
      } catch (err) {
        expect(err.message).to.equal('DB error');
      }
    });
  });
});
