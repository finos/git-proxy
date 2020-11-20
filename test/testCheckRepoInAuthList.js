/* eslint-disable max-len */
const assert = require('assert');
const actions = require('../src/proxy/actions/Action');
const processor = require('../src/proxy/processors/push-action/checkRepoInAuthorisedList');

const authList = () => {
  return ['thisproject/repo-is-ok'];
};

describe('Check a Repo is in the authorised list', async () => {
  it('Should set ok=true if repo in whitelist', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-ok');
    result = await processor.exec(null, action, authList);

    assert.strictEqual(result.error, false);
  });

  it('Should set ok=false if not in authorised', async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    result = await processor.exec(null, action, authList);
    assert.strictEqual(result.error, true);
  });
});
