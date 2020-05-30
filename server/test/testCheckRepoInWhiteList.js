const assert = require('assert');
const processor = require('../lib/processors/checkRepoInWhiteList.js');

const whiteList = () => {
  return ['thisproject/repo-is-ok'];
};

describe('Check a Repo is in the white list', () => {
  it('Should set ok=true if repo in whitelist', () => {
    let result = {
      repo: 'thisproject/repo-is-ok',
      actionLog: [],
      ok: true,
    };
    result = processor.exec(null, result, whiteList);
    assert.equal(result.ok, true);
  });

  it('Should set ok=false if not in whitelist', () => {
    let result = {
      repo: 'thisproject/repo-is-not-ok',
      actionLog: [],
      ok: true,
    };
    result = processor.exec(null, result, whiteList);
    assert.equal(result.ok, false);
  });
});

