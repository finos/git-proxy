const chai = require('chai');
const actions = require('../src/proxy/actions/Action');
const processor = require('../src/proxy/processors/push-action/checkRepoInAuthorisedList');
const expect = chai.expect;
const { Repo } = require('../src/model');

const authList = () => {
  return [
    {
      name: 'repo-is-ok',
      project: 'thisproject',
      url: 'https://github.com/thisproject/repo-is-ok.git'
    },
  ];
};

describe('Check a Repo is in the authorised list', async () => {
  it('Should set ok=true if repo in whitelist', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, new Repo('https://github.com/thisproject/repo-is-ok.git'));
    const result = await processor.exec(null, action, authList);
    expect(result.error).to.be.false;
  });

  it('Should set ok=false if not in authorised', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, new Repo('https://github.com/thisproject/repo-is-not-ok.git'));
    const result = await processor.exec(null, action, authList);
    expect(result.error).to.be.true;
  });
});
