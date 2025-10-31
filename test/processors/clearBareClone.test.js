const fs = require('fs');
const chai = require('chai');
const clearBareClone = require('../../src/proxy/processors/push-action/clearBareClone').exec;
const pullRemote = require('../../src/proxy/processors/push-action/pullRemote').exec;
const { Action } = require('../../src/proxy/actions/Action');
chai.should();

const expect = chai.expect;

const actionId = '123__456';
const timestamp = Date.now();

describe('clear bare and local clones', async () => {
  it('pull remote generates a local .remote folder with hybrid cache structure', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    action.url = 'https://github.com/finos/git-proxy.git';

    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    // Hybrid cache creates: .remote/cache (bare repos) and .remote/work (working copies)
    expect(fs.existsSync(`./.remote/work/${actionId}`)).to.be.true;
    expect(fs.existsSync(`./.remote/cache/git-proxy.git`)).to.be.true;
  }).timeout(20000);

  it('clear bare clone function removes working copy and enforces cache limits', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    await clearBareClone(null, action);
    // clearBareClone removes only the working copy for this push
    expect(fs.existsSync(`./.remote/work/${actionId}`)).to.be.false;
    expect(action.steps.some((s) => s.stepName === 'clearBareClone')).to.be.true;
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmdirSync(`./.remote`, { recursive: true });
    }
  });
});
