const chai = require('chai');
const actions = require('../src/proxy/actions/Action');
const processor = require('../src/proxy/processors/push-action/checkRepoInAuthorisedList');
const expect = chai.expect;
const fc = require('fast-check');

const authList = () => {
  return [
    {
      name: 'repo-is-ok',
      project: 'thisproject',
    },
  ];
};

describe('Check a Repo is in the authorised list', async () => {
  it('Should set ok=true if repo in whitelist', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-ok');
    const result = await processor.exec(null, action, authList);
    expect(result.error).to.be.false;
  });

  it('Should set ok=false if not in authorised', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    const result = await processor.exec(null, action, authList);
    expect(result.error).to.be.true;
  });

  describe('fuzzing', () => {
    it('should not crash on random repo names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (repoName) => {
            const action = new actions.Action('123', 'type', 'get', 1234, repoName);
            const result = await processor.exec(null, action, authList);
            expect(result.error).to.be.true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
