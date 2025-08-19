const chai = require('chai');
const actions = require('../src/proxy/actions/Action');
const processor = require('../src/proxy/processors/push-action/checkRepoInAuthorisedList');
const expect = chai.expect;
const db = require('../src/db');
const fc = require('fast-check');

const TEST_REPO = {
  project: 'thisproject',
  name: 'repo-is-ok',
  url: 'https://github.com/thisproject/repo-is-ok.git',
};

const TEST_NON_EXISTENT_REPO = {
  url: 'https://github.com/thisproject/repo-is-not-ok.git',
};

describe('Check a Repo is in the authorised list', async () => {
  before(async function () {
    const repo = await db.createRepo(TEST_REPO);
    TEST_REPO._id = repo._id;
  });

  after(async function () {
    await db.deleteRepo(TEST_REPO._id);
  });

  it('Should set ok=true if repo in whitelist', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, TEST_REPO.url);
    const result = await processor.exec(null, action);
    expect(result.error).to.be.false;
  });

  it('Should set ok=false if not in authorised', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, TEST_NON_EXISTENT_REPO.url);
    const result = await processor.exec(null, action);
    expect(result.error).to.be.true;
  });

  describe('fuzzing', () => {
    it('should not crash on random repo names', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (repoName) => {
          const action = new actions.Action('123', 'type', 'get', 1234, repoName);
          const result = await processor.exec(null, action);
          expect(result.error).to.be.true;
        }),
        { numRuns: 100 },
      );
    });
  });
});
