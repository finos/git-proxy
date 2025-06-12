// Import the dependencies for testing
const chai = require('chai');
chai.should();
const expect = chai.expect;
const preprocessor = require('../src/proxy/processors/pre-processor/parseAction');

describe('Pre-processor: parseAction', async () => {
  before(async function () {});
  after(async function () {});

  it('should be able to parse a pull request into an action', async function () {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: {},
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).is.greaterThan(0);
    expect(action.id).to.not.be.false;
    expect(action.type).to.equal('pull');
    expect(action.url).to.equal('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a pull request with a legacy path into an action', async function () {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: {},
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).is.greaterThan(0);
    expect(action.id).to.not.be.false;
    expect(action.type).to.equal('pull');
    expect(action.url).to.equal('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request into an action', async function () {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).is.greaterThan(0);
    expect(action.id).to.not.be.false;
    expect(action.type).to.equal('push');
    expect(action.url).to.equal('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request with a legacy path into an action', async function () {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).is.greaterThan(0);
    expect(action.id).to.not.be.false;
    expect(action.type).to.equal('push');
    expect(action.url).to.equal('https://github.com/finos/git-proxy.git');
  });
});
