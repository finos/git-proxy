const { expect } = require('chai');
const sinon = require('sinon');
const proxyqquire = require('proxyquire');

const repoCollection = {
  findOne: sinon.stub(),
};

const connectionStub = sinon.stub().returns(repoCollection);

const { getRepo, getRepoByUrl } = proxyqquire('../../../src/db/mongo/repo', {
  './helper': { connect: connectionStub },
});

describe('MongoDB', () => {
  afterEach(function () {
    sinon.restore();
  });

  describe('getRepo', () => {
    it('should get the repo using the name', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'http://example.com/sample-repo.git',
      };
      repoCollection.findOne.resolves(repoData);

      const result = await getRepo('Sample');
      expect(result).to.deep.equal(repoData);
      expect(connectionStub.calledWith('repos')).to.be.true;
      expect(repoCollection.findOne.calledWith({ name: { $eq: 'sample' } })).to.be.true;
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData = {
        name: 'sample',
        users: { canPush: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };
      repoCollection.findOne.resolves(repoData);

      const result = await getRepoByUrl('https://github.com/finos/git-proxy.git');
      expect(result).to.deep.equal(repoData);
      expect(connectionStub.calledWith('repos')).to.be.true;
      expect(
        repoCollection.findOne.calledWith({
          url: { $eq: 'https://github.com/finos/git-proxy.git' },
        }),
      ).to.be.true;
    });
  });
});
