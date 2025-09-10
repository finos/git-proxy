const chai = require('chai');
const sinon = require('sinon');
const fc = require('fast-check');
const actions = require('../../src/proxy/actions/Action');
const processor = require('../../src/proxy/processors/push-action/checkRepoInAuthorisedList');
const expect = chai.expect;
const db = require('../../src/db');

describe('Check a Repo is in the authorised list', async () => {
  afterEach(() => {
    sinon.restore();
  });

  it('accepts the action if the repository is whitelisted in the db', async () => {
    sinon.stub(db, 'getRepoByUrl').resolves({
      name: 'repo-is-ok',
      project: 'thisproject',
      url: 'https://github.com/thisproject/repo-is-ok',
    });

    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-ok');
    const result = await processor.exec(null, action);
    expect(result.error).to.be.false;
    expect(result.steps[0].logs[0]).to.eq(
      'checkRepoInAuthorisedList - repo thisproject/repo-is-ok is in the authorisedList',
    );
  });

  it('rejects the action if repository not in the db', async () => {
    sinon.stub(db, 'getRepoByUrl').resolves(null);

    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    const result = await processor.exec(null, action);
    expect(result.error).to.be.true;
    expect(result.steps[0].logs[0]).to.eq(
      'checkRepoInAuthorisedList - repo thisproject/repo-is-not-ok is not in the authorised whitelist, ending',
    );
  });

  describe('fuzzing', () => {
    it('should not crash on random repo names', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (repoName) => {
          const action = new actions.Action('123', 'type', 'get', 1234, repoName);
          const result = await processor.exec(null, action);
          expect(result.error).to.be.true;
        }),
        { numRuns: 1000 },
      );
    });
  });
});
