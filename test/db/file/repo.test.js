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
  });
});
