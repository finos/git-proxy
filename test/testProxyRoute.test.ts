import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { describe, it, beforeEach, afterEach, expect, vi, beforeAll, afterAll } from 'vitest';

import { Action, Step } from '../src/proxy/actions';
import * as chain from '../src/proxy/chain';
import * as helper from '../src/proxy/routes/helper';
import { Proxy } from '../src/proxy';
import {
  handleMessage,
  validGitRequest,
  getRouter,
  handleRefsErrorMessage,
  proxyFilter,
} from '../src/proxy/routes';

import * as db from '../src/db';
import { Service } from '../src/service';

const TEST_DEFAULT_REPO = {
  url: 'https://github.com/finos/git-proxy.git',
  name: 'git-proxy',
  project: 'finos',
  host: 'github.com',
  proxyUrlPrefix: '/github.com/finos/git-proxy.git',
};

const TEST_GITLAB_REPO = {
  url: 'https://gitlab.com/gitlab-community/meta.git',
  name: 'gitlab',
  project: 'gitlab-community',
  host: 'gitlab.com',
  proxyUrlPrefix: '/gitlab.com/gitlab-community/meta.git',
};

const TEST_UNKNOWN_REPO = {
  url: 'https://github.com/finos/fdc3.git',
  name: 'fdc3',
  project: 'finos',
  host: 'github.com',
  proxyUrlPrefix: '/github.com/finos/fdc3.git',
  fallbackUrlPrefix: '/finos/fdc3.git',
};

afterAll(() => {
  vi.resetModules();
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
    apiApp = await Service.start(proxy);
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
    await Service.stop();
    await proxy.stop();
    await cleanupRepo(TEST_DEFAULT_REPO.url);
    await cleanupRepo(TEST_GITLAB_REPO.url);
  });

  it('should proxy requests for the default GitHub repository', async () => {
    // Ensure default repo exists
    const repo = await db.getRepoByUrl(TEST_DEFAULT_REPO.url);
    if (!repo) {
      await request(apiApp).post('/api/v1/repo').set('Cookie', cookie).send(TEST_DEFAULT_REPO);
    }

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

    // Clean up any existing gitlab repos first
    await cleanupRepo(TEST_GITLAB_REPO.url);

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

    // Ensure the gitlab test repo exists (create it if a previous test didn't)
    let repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    if (!repo) {
      await request(apiApp).post('/api/v1/repo').set('Cookie', cookie).send(TEST_GITLAB_REPO);
      repo = await db.getRepoByUrl(TEST_GITLAB_REPO.url);
    }
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

  it('should create the default repo if it does not exist', async function () {
    // Remove the default repo from the db and check it no longer exists
    await cleanupRepo(TEST_DEFAULT_REPO.url);

    const repo = await db.getRepoByUrl(TEST_DEFAULT_REPO.url);
    expect(repo).toBeNull();

    // Restart the proxy - wait for server to fully close before restarting
    await proxy.stop();
    // Small delay to ensure port is released
    await new Promise((r) => setTimeout(r, 200));
    await proxy.start();

    // Check that the default repo was created in the db
    const repo2 = await db.getRepoByUrl(TEST_DEFAULT_REPO.url);
    expect(repo2).not.toBeNull();

    // Check that the default repo isn't duplicated on subsequent restarts
    await proxy.stop();
    await new Promise((r) => setTimeout(r, 200));
    await proxy.start();

    const allRepos = await db.getRepos();
    const matchingRepos = allRepos.filter((r) => r.url === TEST_DEFAULT_REPO.url);

    expect(matchingRepos).toHaveLength(1);
  });
});

describe('handleRefsErrorMessage', () => {
  it('should format refs error message correctly', () => {
    const message = 'Repository not found';
    const result = handleRefsErrorMessage(message);

    expect(result).toMatch(/^[0-9a-f]{4}ERR /);
    expect(result).toContain(message);
    expect(result).toContain('\n0000');
  });

  it('should calculate correct length for refs error', () => {
    const message = 'Access denied';
    const result = handleRefsErrorMessage(message);

    const lengthHex = result.substring(0, 4);
    const length = parseInt(lengthHex, 16);

    const errorBody = `ERR ${message}`;
    expect(length).toBe(4 + Buffer.byteLength(errorBody));
  });
});

describe('proxyFilter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;
  let setMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // setup mock response
    statusMock = vi.fn().mockReturnThis();
    sendMock = vi.fn().mockReturnThis();
    setMock = vi.fn().mockReturnThis();

    mockRes = {
      status: statusMock,
      send: sendMock,
      set: setMock,
    };

    // setup mock request
    mockReq = {
      url: '/github.com/finos/git-proxy.git/info/refs?service=git-upload-pack',
      method: 'GET',
      headers: {
        host: 'localhost:8080',
        'user-agent': 'git/2.30.0',
      },
    };

    // reduces console noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Valid requests', () => {
    it('should allow valid GET request to info/refs', async () => {
      // mock helpers to return valid data
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      // mock executeChain to return allowed action
      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(true);
      expect(statusMock).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should allow valid POST request to git-receive-pack', async () => {
      mockReq.method = 'POST';
      mockReq.url = '/github.com/finos/git-proxy.git/git-receive-pack';

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/git-receive-pack',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(true);
    });

    it('should handle bodyRaw for POST pack requests', async () => {
      mockReq.method = 'POST';
      mockReq.url = '/github.com/finos/git-proxy.git/git-upload-pack';
      (mockReq as any).bodyRaw = Buffer.from('test data');

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/git-upload-pack',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as Action);

      await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(mockReq.body).toEqual(Buffer.from('test data'));
      expect((mockReq as any).bodyRaw).toBeUndefined();
    });
  });

  describe('Invalid requests', () => {
    it('should reject request with invalid URL components', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue(null);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalled();
      const sentMessage = sendMock.mock.calls[0][0];
      expect(sentMessage).toContain('Invalid request received');
    });

    it('should reject request with empty gitPath', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '',
        repoPath: 'github.com',
      });

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should reject invalid git request', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(false);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('Blocked requests', () => {
    it('should handle blocked request with message', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: true,
        blockedMessage: 'Repository blocked by policy',
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(setMock).toHaveBeenCalledWith(
        'content-type',
        'application/x-git-upload-pack-advertisement',
      );
      const sentMessage = sendMock.mock.calls[0][0];
      expect(sentMessage).toContain('Repository blocked by policy');
    });

    it('should handle blocked POST request', async () => {
      mockReq.method = 'POST';
      mockReq.url = '/github.com/finos/git-proxy.git/git-receive-pack';

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/git-receive-pack',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: true,
        blockedMessage: 'Push blocked',
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(setMock).toHaveBeenCalledWith('content-type', 'application/x-git-receive-pack-result');
    });
  });

  describe('Error handling', () => {
    it('should handle error from executeChain', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: true,
        blocked: false,
        errorMessage: 'Chain execution failed',
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
      const sentMessage = sendMock.mock.calls[0][0];
      expect(sentMessage).toContain('Chain execution failed');
    });

    it('should handle thrown exception', async () => {
      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockRejectedValue(new Error('Unexpected error'));

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(false);
      expect(statusMock).toHaveBeenCalledWith(200);
      const sentMessage = sendMock.mock.calls[0][0];
      expect(sentMessage).toContain('Error occurred in proxy filter function');
      expect(sentMessage).toContain('Unexpected error');
    });

    it('should use correct error format for GET /info/refs', async () => {
      mockReq.method = 'GET';
      mockReq.url = '/github.com/finos/git-proxy.git/info/refs?service=git-upload-pack';

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/info/refs',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: true,
        blocked: false,
        errorMessage: 'Test error',
      } as Action);

      await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(setMock).toHaveBeenCalledWith(
        'content-type',
        'application/x-git-upload-pack-advertisement',
      );
      const sentMessage = sendMock.mock.calls[0][0];

      expect(sentMessage).toMatch(/^[0-9a-f]{4}ERR /);
    });

    it('should use standard error format for non-refs requests', async () => {
      mockReq.method = 'POST';
      mockReq.url = '/github.com/finos/git-proxy.git/git-receive-pack';

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/finos/git-proxy.git/git-receive-pack',
        repoPath: 'github.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: true,
        blocked: false,
        errorMessage: 'Test error',
      } as Action);

      await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(setMock).toHaveBeenCalledWith('content-type', 'application/x-git-receive-pack-result');
      const sentMessage = sendMock.mock.calls[0][0];
      // should use handleMessage format
      // eslint-disable-next-line no-control-regex
      expect(sentMessage).toMatch(/^[0-9a-f]{4}\x02/);
    });
  });

  describe('Different git operations', () => {
    it('should handle git-upload-pack request', async () => {
      mockReq.method = 'POST';
      mockReq.url = '/gitlab.com/gitlab-community/meta.git/git-upload-pack';

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/gitlab-community/meta.git/git-upload-pack',
        repoPath: 'gitlab.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(true);
    });

    it('should handle different origins (GitLab)', async () => {
      mockReq.url = '/gitlab.com/gitlab-community/meta.git/info/refs?service=git-upload-pack';
      mockReq.headers = {
        ...mockReq.headers,
        host: 'gitlab.com',
      };

      vi.spyOn(helper, 'processUrlPath').mockReturnValue({
        gitPath: '/gitlab-community/meta.git/info/refs',
        repoPath: 'gitlab.com',
      });
      vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);

      vi.spyOn(chain, 'executeChain').mockResolvedValue({
        error: false,
        blocked: false,
      } as Action);

      const result = await proxyFilter?.(mockReq as Request, mockRes as Response);

      expect(result).toBe(true);
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

  describe('handleMessage', () => {
    it('should format error message correctly', () => {
      const message = 'Test error message';
      const result = handleMessage(message);

      // eslint-disable-next-line no-control-regex
      expect(result).toMatch(/^[0-9a-f]{4}\x02\t/);
      expect(result).toContain(message);
      expect(result).toContain('\n0000');
    });

    it('should calculate correct length for message', () => {
      const message = 'Error';
      const result = handleMessage(message);

      const lengthHex = result.substring(0, 4);
      const length = parseInt(lengthHex, 16);

      const body = `\t${message}`;
      expect(length).toBe(6 + Buffer.byteLength(body));
    });
  });

  describe('handleRefsErrorMessage', () => {
    it('should format refs error message correctly', () => {
      const message = 'Repository not found';
      const result = handleRefsErrorMessage(message);

      expect(result).toMatch(/^[0-9a-f]{4}ERR /);
      expect(result).toContain(message);
      expect(result).toContain('\n0000');
    });

    it('should calculate correct length for refs error', () => {
      const message = 'Access denied';
      const result = handleRefsErrorMessage(message);

      const lengthHex = result.substring(0, 4);
      const length = parseInt(lengthHex, 16);

      const errorBody = `ERR ${message}`;
      expect(length).toBe(4 + Buffer.byteLength(errorBody));
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

    // basic header checks (values defined in route)
    expect(res.headers['cache-control']).toBe(
      'no-cache, no-store, must-revalidate, proxy-revalidate',
    );
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
    expect(res.headers['surrogate-control']).toBe('no-store');
  });
});
