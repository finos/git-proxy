const { handleMessage, validGitRequest } = require('../src/proxy/routes');
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
chai.should();
const expect = chai.expect;
const sinon = require('sinon');
const express = require('express');
const getRouter = require('../src/proxy/routes').getRouter;
const chain = require('../src/proxy/chain');
const proxyquire = require('proxyquire');
const { Action, Step } = require('../src/proxy/actions');
const service = require('../src/service');
const db = require('../src/db');

import Proxy from '../src/proxy';

const TEST_DEFAULT_REPO = {
  url: 'https://github.com/finos/git-proxy.git',
  name: 'git-proxy',
  project: 'finos/git-proxy',
  host: 'github.com',
  proxyUrlPrefix: '/github.com/finos/git-proxy.git',
};

const TEST_GITLAB_REPO = {
  url: 'https://gitlab.com/gitlab-community/meta.git',
  name: 'gitlab',
  project: 'gitlab-community/meta',
  host: 'gitlab.com',
  proxyUrlPrefix: '/gitlab.com/gitlab-community/meta.git',
};

const TEST_UNKNOWN_REPO = {
  url: 'https://github.com/finos/fdc3.git',
  name: 'fdc3',
  project: 'finos/fdc3',
  host: 'github.com',
  proxyUrlPrefix: '/github.com/finos/fdc3.git',
  fallbackUrlPrefix: '/finos/fdc3.git',
};

describe('proxy route filter middleware', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use('/', await getRouter());
  });

  afterEach(() => {
    sinon.restore();
  });

  after(() => {
    sinon.restore();
  });

  it('should reject invalid git requests with 400', async () => {
    const res = await chai
      .request(app)
      .get('/owner/repo.git/invalid/path')
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res).to.have.status(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).to.contain('Invalid request received');
  });

  it('should handle blocked requests and return custom packet message', async () => {
    sinon.stub(chain, 'executeChain').resolves({
      blocked: true,
      blockedMessage: 'You shall not push!',
      error: true,
    });

    const res = await chai
      .request(app)
      .post('/owner/repo.git/git-upload-pack')
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .send(Buffer.from('0000'))
      .buffer();

    expect(res.status).to.equal(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).to.contain('You shall not push!');
    expect(res.headers['content-type']).to.include('application/x-git-receive-pack-result');
    expect(res.headers['x-frame-options']).to.equal('DENY');
  });

  describe('when request is valid and not blocked', () => {
    it('should return error if repo is not found', async () => {
      sinon.stub(chain, 'executeChain').resolves({
        blocked: false,
        blockedMessage: '',
        error: false,
      });

      const res = await chai
        .request(app)
        .get('/owner/repo.git/info/refs?service=git-upload-pack')
        .set('user-agent', 'git/2.42.0')
        .set('accept', 'application/x-git-upload-pack-request')
        .buffer();

      expect(res.status).to.equal(401);
      expect(res.text).to.equal('Repository not found.');
    });

    it('should pass through if repo is found', async () => {
      sinon.stub(chain, 'executeChain').resolves({
        blocked: false,
        blockedMessage: '',
        error: false,
      });

      const res = await chai
        .request(app)
        .get('/finos/git-proxy.git/info/refs?service=git-upload-pack')
        .set('user-agent', 'git/2.42.0')
        .set('accept', 'application/x-git-upload-pack-request')
        .buffer();

      expect(res.status).to.equal(200);
      expect(res.text).to.contain('git-upload-pack');
    });
  });
});

describe('proxy route helpers', () => {
  describe('handleMessage', async () => {
    it('should handle short messages', async function () {
      const res = await handleMessage('one');
      expect(res).to.contain('one');
    });

    it('should handle emoji messages', async function () {
      const res = await handleMessage('❌ push failed: too many errors');
      expect(res).to.contain('❌');
    });
  });

  describe('validGitRequest', () => {
    it('should return true for /info/refs?service=git-upload-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'git/2.30.1',
      });
      expect(res).to.be.true;
    });

    it('should return true for /info/refs?service=git-receive-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-receive-pack', {
        'user-agent': 'git/1.9.1',
      });
      expect(res).to.be.true;
    });

    it('should return false for /info/refs?service=git-upload-pack with missing user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {});
      expect(res).to.be.false;
    });

    it('should return false for /info/refs?service=git-upload-pack with non-git user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'curl/7.79.1',
      });
      expect(res).to.be.false;
    });

    it('should return true for /git-upload-pack with valid user-agent and accept', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).to.be.true;
    });

    it('should return false for /git-upload-pack with missing accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
      });
      expect(res).to.be.false;
    });

    it('should return false for /git-upload-pack with wrong accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/json',
      });
      expect(res).to.be.false;
    });

    it('should return false for unknown paths', () => {
      const res = validGitRequest('/not-a-valid-git-path', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).to.be.false;
    });
  });
});

describe('healthcheck route', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use('/', await getRouter());
  });

  it('returns 200 OK with no-cache headers', async () => {
    const res = await chai.request(app).get('/healthcheck');

    expect(res).to.have.status(200);
    expect(res.text).to.equal('OK');

    // Basic header checks (values defined in route)
    expect(res).to.have.header(
      'cache-control',
      'no-cache, no-store, must-revalidate, proxy-revalidate',
    );
    expect(res).to.have.header('pragma', 'no-cache');
    expect(res).to.have.header('expires', '0');
    expect(res).to.have.header('surrogate-control', 'no-store');
  });
});

describe('proxyFilter function', async () => {
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

  afterEach(() => {
    sinon.restore();
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
});

describe('proxy express application', async () => {
  let apiApp;
  let cookie;
  let proxy;

  const setCookie = function (res) {
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        const value = x.split(';')[0];
        cookie = value;
      }
    });
  };

  const cleanupRepo = async (url) => {
    const repo = await db.getRepoByUrl(url);
    if (repo) {
      await db.deleteRepo(repo._id);
    }
  };

  before(async () => {
    // start the API and proxy
    proxy = new Proxy();
    apiApp = await service.start(proxy);
    await proxy.start();

    const res = await chai.request(apiApp).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });
    expect(res).to.have.cookie('connect.sid');
    setCookie(res);

    // if our default repo is not set-up, create it
    const repo = await db.getRepoByUrl(TEST_DEFAULT_REPO.url);
    if (!repo) {
      const res2 = await chai
        .request(apiApp)
        .post('/api/v1/repo')
        .set('Cookie', `${cookie}`)
        .send(TEST_DEFAULT_REPO);
      res2.should.have.status(200);
    }
  });

  after(async () => {
    sinon.restore();
    await service.stop();
    await proxy.stop();
    await cleanupRepo(TEST_DEFAULT_REPO.url);
    await cleanupRepo(TEST_GITLAB_REPO.url);
  });

  it('should proxy requests for the default GitHub repository', async function () {
    // proxy a fetch request
    const res = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_DEFAULT_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();

    expect(res.status).to.equal(200);
    expect(res.text).to.contain('git-upload-pack');
  });

  it('should proxy requests for the default GitHub repository using the fallback URL', async function () {
    // proxy a fetch request using a fallback URL
    const res = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_DEFAULT_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();

    expect(res.status).to.equal(200);
    expect(res.text).to.contain('git-upload-pack');
  });

  it('should be restarted by the api and proxy requests for a new host (e.g. gitlab.com) when a project at that host is ADDED via the API', async function () {
    // Tests that the proxy restarts properly after a project with a URL at a new host is added

    // check that we don't have *any* repos at gitlab.com setup
    const numExistingGitlabRepos = (await db.getRepos({ url: /https:\/\/gitlab\.com/ })).length;
    expect(
      numExistingGitlabRepos,
      'There is a GitLab that exists in the database already, which is NOT expected when running this test',
    ).to.be.equal(0);

    // create the repo through the API, which should force the proxy to restart to handle the new domain
    const res = await chai
      .request(apiApp)
      .post('/api/v1/repo')
      .set('Cookie', `${cookie}`)
      .send(TEST_GITLAB_REPO);
    res.should.have.status(200);

    // confirm that the repo was created in the DB
    const repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(repo).to.not.be.null;

    // and that our initial query for repos would have picked it up
    const numCurrentGitlabRepos = (await db.getRepos({ url: /https:\/\/gitlab\.com/ })).length;
    expect(numCurrentGitlabRepos).to.be.equal(1);

    // proxy a request to the new repo
    const res2 = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_GITLAB_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();

    res2.should.have.status(200);
    expect(res2.text).to.contain('git-upload-pack');
  }).timeout(5000);

  it('should be restarted by the api and stop proxying requests for a host (e.g. gitlab.com) when the last project at that host is DELETED via the API', async function () {
    // We are testing that the proxy stops proxying requests for a particular origin
    // The chain is stubbed and will always passthrough requests, hence, we are only checking what hosts are proxied.

    // the gitlab test repo should already exist
    let repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(repo).to.not.be.null;

    // delete the gitlab test repo, which should force the proxy to restart and stop proxying gitlab.com
    // We assume that there are no other gitlab.com repos present
    const res = await chai
      .request(apiApp)
      .delete('/api/v1/repo/' + repo._id + '/delete')
      .set('Cookie', `${cookie}`)
      .send();
    res.should.have.status(200);

    // confirm that its gone from the DB
    repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(
      repo,
      'The GitLab repo still existed in the database after it should have been deleted...',
    ).to.be.null;

    // give the proxy half a second to restart
    await new Promise((resolve) => setTimeout(resolve, 500));

    // try (and fail) to proxy a request to gitlab.com
    const res2 = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_GITLAB_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();

    res2.should.have.status(200); // status 200 is used to ensure error message is rendered by git client
    expect(res2.text).to.contain('Rejecting repo');
  }).timeout(5000);

  it('should not proxy requests for an unknown project', async function () {
    // We are testing that the proxy stops proxying requests for a particular origin
    // The chain is stubbed and will always passthrough requests, hence, we are only checking what hosts are proxied.

    // the gitlab test repo should already exist
    const repo = await db.getRepoByUrl(TEST_UNKNOWN_REPO.url);
    expect(
      repo,
      'The unknown (but real) repo existed in the database which is not expected for this test',
    ).to.be.null;

    // try (and fail) to proxy a request to the repo directly
    const res = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_UNKNOWN_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();
    res.should.have.status(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).to.contain('Rejecting repo');

    // try (and fail) to proxy a request to the repo via the fallback URL directly
    const res2 = await chai
      .request(proxy.getExpressApp())
      .get(`${TEST_UNKNOWN_REPO.fallbackUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .buffer();
    res2.should.have.status(200);
    expect(res2.text).to.contain('Rejecting repo');
  }).timeout(5000);
});
