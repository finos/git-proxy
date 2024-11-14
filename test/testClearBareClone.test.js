const fs = require('fs');
const chai = require('chai');
const clearBareClone = require('../src/proxy/processors/push-action/clearBareClone').exec;
const pullRemote = require('../src/proxy/processors/push-action/pullRemote').exec;
const { Action } = require('../src/proxy/actions/Action');
chai.should();

const expect = chai.expect;
const timestamp = Date.now();

describe('clear bare and local clones', async () => {
  it('pull remote generates a local .remote folder', async function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(5000);
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    action.url = 'https://github.com/finos/git-proxy';
    await pullRemote({}, action);

    expect(fs.existsSync(`./.remote/${timestamp}`)).to.be.true;
  });

  it('clear bare clone function purges .remote folder and specific clone folder', async () => {
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    await clearBareClone(null, action);
    expect(fs.existsSync(`./.remote`)).to.throw;
    expect(fs.existsSync(`./.remote/${timestamp}`)).to.throw;
  });
});
