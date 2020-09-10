const assert = require('assert');
const actions = require('../src/node_modules/proxy/actions/Action');
const processor = require('../src/node_modules/proxy/processors/push-action/checkRepoInAuthorisedList');

const authList = () => {
  return ['thisproject/repo-is-ok'];
};

describe('Check a Repo is in the authorised list', () => {
  it('Should set ok=true if repo in whitelist', () => {
    let action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-ok');
    result = processor.exec(null, action, authList);
    console.log(result);
    assert.equal(result.error, false);
  });

  it('Should set ok=false if not in authorised', () => {
    let action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    result = processor.exec(null, action, authList);
    console.log(result);
    assert.equal(result.error, true);
  });
});

