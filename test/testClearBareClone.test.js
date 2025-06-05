const fs = require('fs');
const chai = require('chai');
const clearBareClone = require('../src/proxy/processors/push-action/clearBareClone').exec;
const pullRemote = require('../src/proxy/processors/push-action/pullRemote').exec;
const { Action } = require('../src/proxy/actions/Action');
chai.should();

const expect = chai.expect;
const timestamp = Date.now();

describe('clear bare and local clones', async () => {
  it('pull remote generates a local .remote folder', async () => {
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    action.url = 'https://github.com/finos/git-proxy';

    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    expect(fs.existsSync(`./.remote/${timestamp}`)).to.be.true;
  }).timeout(20000);

  it('clear bare clone function purges .remote folder and specific clone folder', async () => {
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    await clearBareClone(null, action);
    expect(fs.existsSync(`./.remote`)).to.throw;
    expect(fs.existsSync(`./.remote/${timestamp}`)).to.throw;
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmdirSync(`./.remote`, { recursive: true });
    }
  });
});
