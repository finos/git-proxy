/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { describe, it, beforeEach, afterEach, expect, vi, beforeAll, afterAll } from 'vitest';

import { Action, Step } from '../src/proxy/actions';
import * as chain from '../src/proxy/chain';
import * as helper from '../src/proxy/routes/helper';
import * as config from '../src/config';
import { Proxy } from '../src/proxy';
import {
  handleMessage,
  validGitRequest,
  getRouter,
  handleRefsErrorMessage,
  proxyFilter,
  isReceivePackPost,
  createReceivePackHandler,
  resolveUpstreamUrl,
  forwardReceivePackUpstream,
  endStreamedResponseWithMessage,
} from '../src/proxy/routes';
import { encodeSidebandChunk, SidebandBand } from '../src/proxy/sideband';

import * as db from '../src/db';
import { Service } from '../src/service';

/** Collects a binary supertest response body into a Buffer. */
const binaryParser = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

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

describe('isReceivePackPost', () => {
  it('should return true for POST requests to git-receive-pack', () => {
    const req = {
      method: 'POST',
      url: '/github.com/finos/git-proxy.git/git-receive-pack',
    } as Request;
    expect(isReceivePackPost(req)).toBe(true);
  });

  it('should return false for git-upload-pack POSTs and GET requests', () => {
    expect(
      isReceivePackPost({
        method: 'POST',
        url: '/github.com/finos/git-proxy.git/git-upload-pack',
      } as Request),
    ).toBe(false);
    expect(
      isReceivePackPost({
        method: 'GET',
        url: '/github.com/finos/git-proxy.git/git-receive-pack',
      } as Request),
    ).toBe(false);
  });
});

describe('resolveUpstreamUrl', () => {
  it('should resolve the upstream URL from the origin in the request path', () => {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-receive-pack',
    } as Request;
    const url = resolveUpstreamUrl(req, ['github.com', 'gitlab.com']);

    expect(url.href).toBe('https://github.com/finos/git-proxy.git/git-receive-pack');
  });

  it('should resolve non-github origins', () => {
    const req = {
      originalUrl: '/gitlab.com/gitlab-community/meta.git/git-receive-pack',
    } as Request;
    const url = resolveUpstreamUrl(req, ['github.com', 'gitlab.com']);

    expect(url.href).toBe('https://gitlab.com/gitlab-community/meta.git/git-receive-pack');
  });

  it('should fall back to github.com for legacy URLs without an origin prefix', () => {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-receive-pack',
    } as Request;
    const url = resolveUpstreamUrl(req, ['gitlab.com']);

    expect(url.href).toBe('https://github.com/finos/git-proxy.git/git-receive-pack');
  });
});

describe('endStreamedResponseWithMessage', () => {
  it('should write the final message on band 2, a flush packet and end the response', () => {
    const writes: Buffer[] = [];
    const res = {
      writableEnded: false,
      write: vi.fn((chunk: Buffer | string) => {
        writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      }),
      end: vi.fn(),
    } as unknown as Response;

    endStreamedResponseWithMessage(res, 'Push blocked');

    const body = Buffer.concat(writes).toString('utf8');
    // eslint-disable-next-line no-control-regex
    expect(body).toMatch(/^[0-9a-f]{4}\x02\tPush blocked\n0000$/);
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('should do nothing when the response has already ended', () => {
    const res = {
      writableEnded: true,
      write: vi.fn(),
      end: vi.fn(),
    } as unknown as Response;

    endStreamedResponseWithMessage(res, 'too late');

    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});

describe('createReceivePackHandler', () => {
  const handler = createReceivePackHandler(['github.com']);
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response> & { headersSent: boolean };
  let nextMock: ReturnType<typeof vi.fn>;
  let writes: Buffer[];

  beforeEach(() => {
    writes = [];
    nextMock = vi.fn();
    mockRes = {
      headersSent: false,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      write: vi.fn((chunk: Buffer | string) => {
        writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      }),
      end: vi.fn(),
    } as unknown as Partial<Response> & { headersSent: boolean };

    mockReq = {
      method: 'POST',
      url: '/github.com/finos/git-proxy.git/git-receive-pack',
      originalUrl: '/github.com/finos/git-proxy.git/git-receive-pack',
      headers: {
        host: 'localhost:8080',
        'user-agent': 'git/2.42.0',
        accept: 'application/x-git-receive-pack-result',
      },
      body: Buffer.from('test'),
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should defer to the next handler for non receive-pack requests', async () => {
    mockReq.method = 'GET';

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(nextMock).toHaveBeenCalledOnce();
  });

  it('should defer to the next handler when sidebandProgress is disabled', async () => {
    vi.spyOn(config, 'getSidebandProgressEnabled').mockReturnValue(false);

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(nextMock).toHaveBeenCalledOnce();
  });

  it('should reject invalid requests without invoking the chain', async () => {
    vi.spyOn(helper, 'processUrlPath').mockReturnValue(null);
    const executeChainSpy = vi.spyOn(chain, 'executeChain');

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(executeChainSpy).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(mockRes.send!).mock.calls[0][0]).toContain('Invalid request received');
  });

  it('should send a buffered error response when the chain blocked without streaming', async () => {
    vi.spyOn(helper, 'processUrlPath').mockReturnValue({
      gitPath: '/finos/git-proxy.git/git-receive-pack',
      repoPath: 'github.com',
    });
    vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);
    vi.spyOn(chain, 'executeChain').mockResolvedValue({
      error: false,
      blocked: true,
      blockedMessage: 'Push blocked by policy',
    } as Action);

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(nextMock).not.toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith(
      'content-type',
      'application/x-git-receive-pack-result',
    );
    const sentMessage = vi.mocked(mockRes.send!).mock.calls[0][0];
    // eslint-disable-next-line no-control-regex
    expect(sentMessage).toMatch(/^[0-9a-f]{4}\x02/);
    expect(sentMessage).toContain('Push blocked by policy');
  });

  it('should finish the sideband stream when the chain blocked after streaming started', async () => {
    vi.spyOn(helper, 'processUrlPath').mockReturnValue({
      gitPath: '/finos/git-proxy.git/git-receive-pack',
      repoPath: 'github.com',
    });
    vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);
    vi.spyOn(chain, 'executeChain').mockImplementation(async () => {
      // simulate the progress writer having flushed headers mid-chain
      mockRes.headersSent = true;
      return {
        error: false,
        blocked: true,
        blockedMessage: 'Push blocked by policy',
      } as Action;
    });

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(mockRes.send).not.toHaveBeenCalled();
    const body = Buffer.concat(writes).toString('utf8');
    // eslint-disable-next-line no-control-regex
    expect(body).toMatch(/^[0-9a-f]{4}\x02\tPush blocked by policy\n0000$/);
    expect(mockRes.end).toHaveBeenCalledOnce();
  });

  it('should move the raw body onto req.body before invoking the chain', async () => {
    vi.spyOn(helper, 'processUrlPath').mockReturnValue({
      gitPath: '/finos/git-proxy.git/git-receive-pack',
      repoPath: 'github.com',
    });
    vi.spyOn(helper, 'validGitRequest').mockReturnValue(true);
    vi.spyOn(chain, 'executeChain').mockResolvedValue({
      error: true,
      blocked: false,
      errorMessage: 'stop here',
    } as Action);
    (mockReq as any).bodyRaw = Buffer.from('raw pack data');

    await handler(mockReq as Request, mockRes as Response, nextMock);

    expect(mockReq.body).toEqual(Buffer.from('raw pack data'));
    expect((mockReq as any).bodyRaw).toBeUndefined();
  });
});

describe('forwardReceivePackUpstream', () => {
  let upstreamServer: http.Server;
  let upstreamPort: number;
  let lastUpstreamReq: {
    method?: string;
    url?: string;
    headers?: http.IncomingHttpHeaders;
    body?: Buffer;
  };

  const upstreamBody = Buffer.concat([
    encodeSidebandChunk(SidebandBand.Data, 'unpack ok\n'),
    Buffer.from('0000'),
  ]);

  beforeAll(async () => {
    upstreamServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        lastUpstreamReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks),
        };
        if (req.url === '/upstream-401') {
          res.writeHead(401, { 'content-type': 'text/plain' });
          res.end('auth required');
          return;
        }
        res.writeHead(200, {
          'content-type': 'application/x-git-receive-pack-result',
          'x-upstream-header': 'yes',
        });
        res.end(upstreamBody);
      });
    });
    await new Promise<void>((resolve) => upstreamServer.listen(0, resolve));
    upstreamPort = (upstreamServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      upstreamServer.close((err) => (err ? reject(err) : resolve())),
    );
  });

  const createApp = (streaming: boolean, upstreamPath = '/upstream') => {
    const app = express();
    app.post('/push', async (req, res, next) => {
      try {
        req.body = Buffer.from('PACKDATA');
        if (streaming) {
          res.status(200);
          res.set('content-type', 'application/x-git-receive-pack-result');
          res.flushHeaders();
          res.write(encodeSidebandChunk(SidebandBand.Progress, 'validating...\n'));
        }
        await forwardReceivePackUpstream(
          req,
          res,
          new URL(`http://127.0.0.1:${upstreamPort}${upstreamPath}`),
        );
      } catch (err) {
        next(err);
      }
    });
    return app;
  };

  it('should append the upstream response verbatim to an in-progress sideband stream', async () => {
    const res = await request(createApp(true))
      .post('/push')
      .set('authorization', 'Basic dGVzdDp0ZXN0')
      .set('accept-encoding', 'gzip')
      .buffer(true)
      .parse(binaryParser)
      .send();

    expect(res.status).toBe(200);
    const body = (res.body as Buffer).toString('utf8');
    expect(body).toContain('validating...');
    expect(body).toContain('unpack ok');
    expect(body.endsWith('0000')).toBe(true);

    // proxy-generated packets come first, upstream bytes are appended verbatim
    expect(body.indexOf('validating...')).toBeLessThan(body.indexOf('unpack ok'));

    // upstream received the buffered body with credentials, but no accept-encoding
    expect(lastUpstreamReq.method).toBe('POST');
    expect(lastUpstreamReq.body?.toString('utf8')).toBe('PACKDATA');
    expect(lastUpstreamReq.headers?.authorization).toBe('Basic dGVzdDp0ZXN0');
    expect(lastUpstreamReq.headers?.['accept-encoding']).toBeUndefined();
    expect(lastUpstreamReq.headers?.['content-length']).toBe('8');
  });

  it('should relay upstream status, headers and body when no streaming took place', async () => {
    const res = await request(createApp(false))
      .post('/push')
      .buffer(true)
      .parse(binaryParser)
      .send();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/x-git-receive-pack-result');
    expect(res.headers['x-upstream-header']).toBe('yes');
    expect((res.body as Buffer).equals(upstreamBody)).toBe(true);
  });

  it('should end the stream with an error message when upstream responds with a non-200 status', async () => {
    const res = await request(createApp(true, '/upstream-401'))
      .post('/push')
      .buffer(true)
      .parse(binaryParser)
      .send();

    expect(res.status).toBe(200); // headers were already flushed before the upstream call
    const body = (res.body as Buffer).toString('utf8');
    expect(body).toContain('validating...');
    expect(body).toContain('upstream responded with status 401');
    expect(body.endsWith('0000')).toBe(true);
  });
});

describe('receive-pack route wiring', () => {
  let app: Express;

  beforeEach(async () => {
    app = express();
    app.use('/', await getRouter());
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sendPush = () =>
    request(app)
      .post('/github.com/finos/git-proxy.git/git-receive-pack')
      .set('user-agent', 'git/2.42.0')
      .set('accept', 'application/x-git-receive-pack-result')
      .set('content-type', 'application/x-git-receive-pack-request')
      .buffer(true)
      .parse(binaryParser)
      .send(Buffer.from('0000'));

  it('should stream chain progress followed by the final blocked message', async () => {
    vi.spyOn(chain, 'executeChain').mockImplementation(async (req, res) => {
      // simulate the progress writer streaming a step message mid-chain
      res.status(200);
      res.set('content-type', 'application/x-git-receive-pack-result');
      res.flushHeaders();
      res.write(
        encodeSidebandChunk(SidebandBand.Progress, 'checking repository is authorised...\n'),
      );
      return {
        error: false,
        blocked: true,
        blockedMessage: 'Push blocked by policy',
      } as Action;
    });

    const res = await sendPush();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-git-receive-pack-result');
    const body = (res.body as Buffer).toString('utf8');
    expect(body).toContain('checking repository is authorised...');
    expect(body).toContain('Push blocked by policy');
    expect(body.endsWith('0000')).toBe(true);
  });

  it('should send a single buffered response when the chain did not stream', async () => {
    vi.spyOn(chain, 'executeChain').mockResolvedValue({
      error: false,
      blocked: true,
      blockedMessage: 'Push blocked by policy',
    } as Action);

    const res = await sendPush();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-git-receive-pack-result');
    const body = (res.body as Buffer).toString('utf8');
    // eslint-disable-next-line no-control-regex
    expect(body).toMatch(/^[0-9a-f]{4}\x02\tPush blocked by policy\n0000$/);
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
