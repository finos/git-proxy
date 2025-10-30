import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as preprocessor from '../src/proxy/processors/pre-processor/parseAction';
import * as db from '../src/db';

let testRepo: any = null;

const TEST_REPO = {
  url: 'https://github.com/finos/git-proxy.git',
  name: 'git-proxy',
  project: 'finos',
};

describe('Pre-processor: parseAction', () => {
  beforeAll(async () => {
    // make sure the test repo exists as the presence of the repo makes a difference to handling of urls
    testRepo = await db.getRepoByUrl(TEST_REPO.url);
    if (!testRepo) {
      testRepo = await db.createRepo(TEST_REPO);
    }
  });

  afterAll(async () => {
    // clean up test DB
    if (testRepo?._id) {
      await db.deleteRepo(testRepo._id);
    }
  });

  it('should be able to parse a pull request into an action', async () => {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: { 'content-type': 'application/x-git-upload-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('pull');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a pull request with a legacy path into an action', async () => {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: { 'content-type': 'application/x-git-upload-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('pull');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request into an action', async () => {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('push');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request with a legacy path into an action', async () => {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('push');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });
});
