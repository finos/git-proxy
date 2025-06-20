const handleMessage = require('../src/proxy/routes').handleMessage;
const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = chai.expect;
const { Action, Step } = require('../src/proxy/actions');

// Use this test as a template
describe('proxy error messages', async () => {
  it('should handle short messages', async function () {
    const res = await handleMessage('one');
    expect(res).to.contain('one');
  });

  it('should handle emoji messages', async function () {
    const res = await handleMessage('❌ push failed: too many errors');
    expect(res).to.contain('❌');
  });
});

describe('proxy route filter', async () => {
  let proxyRoutes;
  let req;
  let res;
  let actionToReturn;
  let executeChainStub;

  beforeEach(async () => {
    executeChainStub = sinon.stub();

    // Re-import the proxy routes module and stub executeChain
    proxyRoutes = proxyquire('../src/proxy/routes', {
      '../chain': { executeChain: executeChainStub },
    });

    req = {
      url: '/github.com/finos/git-proxy.git/info/refs?service=git-receive-pack',
      headers: {
        host: 'dummyHost',
        'user-agent': 'git/dummy-git-client',
        accept: 'application/x-git-receive-pack-request',
      },
    };
    res = {
      set: () => {},
      status: () => {
        return {
          send: () => {},
        };
      },
    };
  });

  it('should return false for push requests that should be blocked', async function () {
    // mock the executeChain function
    actionToReturn = new Action(
      1234,
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', false, null, true, 'test block', null);
    actionToReturn.addStep(step);
    executeChainStub.returns(actionToReturn);
    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).to.be.false;
  });

  it('should return false for push requests that produced errors', async function () {
    // mock the executeChain function
    actionToReturn = new Action(
      1234,
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', true, 'test error', false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.returns(actionToReturn);
    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).to.be.false;
  });

  it('should return false for invalid push requests', async function () {
    // mock the executeChain function
    actionToReturn = new Action(
      1234,
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', true, 'test error', false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.returns(actionToReturn);

    // create an invalid request
    req = {
      url: '/github.com/finos/git-proxy.git/invalidPath',
      headers: {
        host: 'dummyHost',
        'user-agent': 'git/dummy-git-client',
        accept: 'application/x-git-receive-pack-request',
      },
    };

    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).to.be.false;
  });

  it('should return true for push requests that are valid and pass the chain', async function () {
    // mock the executeChain function
    actionToReturn = new Action(
      1234,
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', false, null, false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.returns(actionToReturn);
    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).to.be.true;
  });

  afterEach(() => {
    sinon.restore();
  });
});
