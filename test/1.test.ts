/*
  Template test file. Demonstrates how to:
  - Initialize the server
  - Stub dependencies with vi.spyOn
  - Use supertest to make requests to the server
  - Reset stubs after each test
  - Use vi.doMock to replace modules
  - Reset module cache after a test
*/

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, vi } from 'vitest';
import request from 'supertest';
import service from '../src/service';
import * as db from '../src/db';
import Proxy from '../src/proxy';

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git',
  users: { canPush: [], canAuthorise: [] },
};

describe('init', () => {
  let app: any;

  // Runs before all tests
  beforeAll(async function () {
    // Starts the service and returns the express app
    const proxy = new Proxy();
    app = await service.start(proxy);
  });

  // Runs before each test
  beforeEach(async function () {
    // Example: stub a DB method
    vi.spyOn(db, 'getRepo').mockResolvedValue(TEST_REPO);
  });

  // Example test: check server is running
  it('should return 401 if not logged in', async function () {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  // Example test: check db stub is working
  it('should get the repo from stubbed db', async function () {
    const repo = await db.getRepo('finos/db-test-repo');
    expect(repo).toEqual(TEST_REPO);
  });

  // Example test: use vi.doMock to override the config module
  it('should return an array of enabled auth methods when overridden', async () => {
    vi.resetModules(); // Clear module cache

    // fs must be mocked BEFORE importing the config module
    // We also mock existsSync to ensure the file "exists"
    vi.doMock('fs', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        readFileSync: vi.fn().mockReturnValue(
          JSON.stringify({
            authentication: [
              { type: 'local', enabled: true },
              { type: 'ActiveDirectory', enabled: true },
              { type: 'openidconnect', enabled: true },
            ],
          }),
        ),
        existsSync: vi.fn().mockReturnValue(true),
      };
    });

    // Then we inline import the config module to use the mocked fs
    // Top-level imports don't work here (they resolve to the original fs module)
    const config = await import('../src/config');
    config.initUserConfig();

    const authMethods = config.getAuthMethods();
    expect(authMethods).toHaveLength(3);
    expect(authMethods[0].type).toBe('local');
  });

  // Runs after each test
  afterEach(function () {
    // Restore all stubs
    vi.restoreAllMocks();
  });

  // Runs after all tests
  afterAll(function () {
    service.httpServer.close();
  });
});
