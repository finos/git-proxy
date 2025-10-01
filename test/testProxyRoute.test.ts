import request from 'supertest';
import express, { Express } from 'express';
import { describe, it, beforeEach, afterEach, expect, vi, beforeAll, afterAll } from 'vitest';

import { Action, Step } from '../src/proxy/actions';
import * as chain from '../src/proxy/chain';
import Proxy from '../src/proxy';
import {
  handleMessage,
  validGitRequest,
  getRouter,
  handleRefsErrorMessage,
} from '../src/proxy/routes';

import * as db from '../src/db';
import service from '../src/service';

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
  let app: Express;

  beforeEach(async () => {
    app = express();
    app.use('/', await getRouter());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject invalid git requests with 400', async () => {
    const res = await request(app)
      .get('/owner/repo.git/invalid/path')
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res.status).toBe(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).toContain('Invalid request received');
  });

  it('should handle blocked requests and return custom packet message', async () => {
    vi.spyOn(chain, 'executeChain').mockResolvedValue({
      blocked: true,
      blockedMessage: 'You shall not push!',
      error: true,
    } as Action);

    const res = await request(app)
      .post('/owner/repo.git/git-upload-pack')
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request')
      .send(Buffer.from('0000'));

    expect(res.status).toBe(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).toContain('You shall not push!');
    expect(res.headers['content-type']).toContain('application/x-git-receive-pack-result');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  describe('when request is valid and not blocked', () => {
    it('should return error if repo is not found', async () => {
      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        blocked: false,
        blockedMessage: '',
        error: false,
      } as Action);

      const res = await request(app)
        .get('/owner/repo.git/info/refs?service=git-upload-pack')
        .set('user-agent', 'git/2.42.0')
        .set('accept', 'application/x-git-upload-pack-request');

      expect(res.status).toBe(401);
      expect(res.text).toBe('Repository not found.');
    });

    it('should pass through if repo is found', async () => {
      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        blocked: false,
        blockedMessage: '',
        error: false,
      } as Action);

      const res = await request(app)
        .get('/finos/git-proxy.git/info/refs?service=git-upload-pack')
        .set('user-agent', 'git/2.42.0')
        .set('accept', 'application/x-git-upload-pack-request');

      expect(res.status).toBe(200);
      expect(res.text).toContain('git-upload-pack');
    });
  });
});

describe('proxy route helpers', () => {
  describe('handleMessage', async () => {
    it('should handle short messages', async () => {
      const res = await handleMessage('one');
      expect(res).toContain('one');
    });

    it('should handle emoji messages', async () => {
      const res = await handleMessage('❌ push failed: too many errors');
      expect(res).toContain('❌');
    });
  });

  describe('validGitRequest', () => {
    it('should return true for /info/refs?service=git-upload-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'git/2.30.1',
      });
      expect(res).toBe(true);
    });

    it('should return true for /info/refs?service=git-receive-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-receive-pack', {
        'user-agent': 'git/1.9.1',
      });
      expect(res).toBe(true);
    });

    it('should return false for /info/refs?service=git-upload-pack with missing user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {});
      expect(res).toBe(false);
    });

    it('should return false for /info/refs?service=git-upload-pack with non-git user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'curl/7.79.1',
      });
      expect(res).toBe(false);
    });

    it('should return true for /git-upload-pack with valid user-agent and accept', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).toBe(true);
    });

    it('should return false for /git-upload-pack with missing accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
      });
      expect(res).toBe(false);
    });

    it('should return false for /git-upload-pack with wrong accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/json',
      });
      expect(res).toBe(false);
    });

    it('should return false for unknown paths', () => {
      const res = validGitRequest('/not-a-valid-git-path', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).toBe(false);
    });
  });
});

describe('healthcheck route', () => {
  let app: Express;

  beforeEach(async () => {
    app = express();
    app.use('/', await getRouter());
  });

  it('returns 200 OK with no-cache headers', async () => {
    const res = await request(app).get('/healthcheck');

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');

    // Basic header checks (values defined in route)
    expect(res.headers['cache-control']).toBe(
      'no-cache, no-store, must-revalidate, proxy-revalidate',
    );
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
    expect(res.headers['surrogate-control']).toBe('no-store');
  });
});

describe('proxy express application', () => {
  let apiApp: Express;
  let proxy: Proxy;
  let cookie: string;

  const setCookie = (res: request.Response) => {
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      for (const x of cookies) {
        if (x.startsWith('connect')) {
          cookie = x.split(';')[0];
          break;
        }
      }
    }
  };

  const cleanupRepo = async (url: string) => {
    const repo = await db.getRepoByUrl(url);
    if (repo) {
      await db.deleteRepo(repo._id!);
    }
  };

  beforeAll(async () => {
    // start the API and proxy
    proxy = new Proxy();
    apiApp = await service.start(proxy);
    await proxy.start();

    const res = await request(apiApp)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });

    expect(res.headers['set-cookie']).toBeDefined();
    setCookie(res);

    // if our default repo is not set-up, create it
    const repo = await db.getRepoByUrl(TEST_DEFAULT_REPO.url);
    if (!repo) {
      const res2 = await request(apiApp)
        .post('/api/v1/repo')
        .set('Cookie', cookie)
        .send(TEST_DEFAULT_REPO);
      expect(res2.status).toBe(200);
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await service.stop();
    await proxy.stop();
    await cleanupRepo(TEST_DEFAULT_REPO.url);
    await cleanupRepo(TEST_GITLAB_REPO.url);
  });

  it('should proxy requests for the default GitHub repository', async () => {
    // proxy a fetch request
    const res = await request(proxy.getExpressApp()!)
      .get(`${TEST_DEFAULT_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res.status).toBe(200);
    expect(res.text).toContain('git-upload-pack');
  });

  it('should proxy requests for the default GitHub repository using the fallback URL', async () => {
    // proxy a fetch request using a fallback URL
    const res = await request(proxy.getExpressApp()!)
      .get(`${TEST_DEFAULT_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res.status).toBe(200);
    expect(res.text).toContain('git-upload-pack');
  });

  it('should restart and proxy for a new host when project is ADDED', async () => {
    // Tests that the proxy restarts properly after a project with a URL at a new host is added

    // check that we don't have *any* repos at gitlab.com setup
    const numExisting = (await db.getRepos({ url: /https:\/\/gitlab\.com/ as any })).length;
    expect(numExisting).toBe(0);

    // create the repo through the API, which should force the proxy to restart to handle the new domain
    const res = await request(apiApp)
      .post('/api/v1/repo')
      .set('Cookie', cookie)
      .send(TEST_GITLAB_REPO);
    expect(res.status).toBe(200);

    // confirm that the repo was created in the DB
    const repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(repo).not.toBeNull();

    // and that our initial query for repos would have picked it up
    const numCurrent = (await db.getRepos({ url: /https:\/\/gitlab\.com/ as any })).length;
    expect(numCurrent).toBe(1);

    // proxy a request to the new repo
    const res2 = await request(proxy.getExpressApp()!)
      .get(`${TEST_GITLAB_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res2.status).toBe(200);
    expect(res2.text).toContain('git-upload-pack');
  }, 5000);

  it('should restart and stop proxying for a host when project is DELETED', async () => {
    // We are testing that the proxy stops proxying requests for a particular origin
    // The chain is stubbed and will always passthrough requests, hence, we are only checking what hosts are proxied.

    // the gitlab test repo should already exist
    let repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(repo).not.toBeNull();

    // delete the gitlab test repo, which should force the proxy to restart and stop proxying gitlab.com
    // We assume that there are no other gitlab.com repos present
    const res = await request(apiApp)
      .delete(`/api/v1/repo/${repo?._id}/delete`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    // confirm that its gone from the DB
    repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    expect(repo).toBeNull();

    // give the proxy half a second to restart
    await new Promise((r) => setTimeout(r, 500));

    // try (and fail) to proxy a request to gitlab.com
    const res2 = await request(proxy.getExpressApp()!)
      .get(`${TEST_GITLAB_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res2.status).toBe(200); // status 200 is used to ensure error message is rendered by git client
    expect(res2.text).toContain('Rejecting repo');
  }, 5000);

  it('should not proxy requests for an unknown project', async () => {
    // We are testing that the proxy stops proxying requests for a particular origin
    // The chain is stubbed and will always passthrough requests, hence, we are only checking what hosts are proxied.

    // the unknown test repo should already exist
    const repo = await db.getRepoByUrl(TEST_UNKNOWN_REPO.url);
    expect(repo).toBeNull();

    // try (and fail) to proxy a request to the repo directly
    const res = await request(proxy.getExpressApp()!)
      .get(`${TEST_UNKNOWN_REPO.proxyUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res.status).toBe(200); // status 200 is used to ensure error message is rendered by git client
    expect(res.text).toContain('Rejecting repo');

    // try (and fail) to proxy a request to the repo via the fallback URL directly
    const res2 = await request(proxy.getExpressApp()!)
      .get(`${TEST_UNKNOWN_REPO.fallbackUrlPrefix}/info/refs?service=git-upload-pack`)
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-upload-pack-request');

    expect(res2.status).toBe(200);
    expect(res2.text).toContain('Rejecting repo');
  }, 5000);
});

describe('proxyFilter function', () => {
  let proxyRoutes: any;
  let req: any;
  let res: any;
  let actionToReturn: any;
  let executeChainStub: any;

  beforeEach(async () => {
    // mock the executeChain function
    executeChainStub = vi.fn();
    vi.doMock('../src/proxy/chain', () => ({
      executeChain: executeChainStub,
    }));

    // Re-import with mocked chain
    proxyRoutes = await import('../src/proxy/routes');

    req = {
      url: '/github.com/finos/git-proxy.git/info/refs?service=git-receive-pack',
      headers: {
        host: 'dummyHost',
        'user-agent': 'git/dummy-git-client',
        accept: 'application/x-git-receive-pack-request',
      },
    };
    res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('should return false for push requests that should be blocked', async () => {
    actionToReturn = new Action(
      '1234',
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', false, null, true, 'test block', null);
    actionToReturn.addStep(step);
    executeChainStub.mockReturnValue(actionToReturn);

    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).toBe(false);
  });

  it('should return false for push requests that produced errors', async () => {
    actionToReturn = new Action(
      '1234',
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', true, 'test error', false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.mockReturnValue(actionToReturn);

    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).toBe(false);
  });

  it('should return false for invalid push requests', async () => {
    actionToReturn = new Action(
      '1234',
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', true, 'test error', false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.mockReturnValue(actionToReturn);

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
    expect(result).toBe(false);
  });

  it('should return true for push requests that are valid and pass the chain', async () => {
    actionToReturn = new Action(
      '1234',
      'dummy',
      'dummy',
      Date.now(),
      '/github.com/finos/git-proxy.git',
    );
    const step = new Step('dummy', false, null, false, null, null);
    actionToReturn.addStep(step);
    executeChainStub.mockReturnValue(actionToReturn);

    const result = await proxyRoutes.proxyFilter(req, res);
    expect(result).toBe(true);
  });

  it('should handle GET /info/refs with blocked action using Git protocol error format', async () => {
    const req = {
      url: '/proj/repo.git/info/refs?service=git-upload-pack',
      method: 'GET',
      headers: {
        host: 'localhost',
        'user-agent': 'git/2.34.1',
      },
    };
    const res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const actionToReturn = {
      blocked: true,
      blockedMessage: 'Repository not in authorised list',
    };

    executeChainStub.mockReturnValue(actionToReturn);
    const result = await proxyRoutes.proxyFilter(req, res);

    expect(result).toBe(false);

    const expectedPacket = handleRefsErrorMessage('Repository not in authorised list');

    expect(res.set).toHaveBeenCalledWith(
      'content-type',
      'application/x-git-upload-pack-advertisement',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expectedPacket);
  });
});
