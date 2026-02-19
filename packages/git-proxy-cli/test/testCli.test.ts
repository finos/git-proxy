import * as helper from './testCliUtils';
import path from 'path';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { setConfigFile } from '../../../src/config/file';
import { SAMPLE_REPO } from '../../../src/proxy/processors/constants';
import { handleAndLogError } from '../../../src/utils/errors';

setConfigFile(path.join(process.cwd(), 'test', 'testCli.proxy.config.json'));

/* test constants */
// push ID which does not exist
const GHOST_PUSH_ID =
  '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';
// repo for test cases
const TEST_REPO_CONFIG = {
  ...SAMPLE_REPO,
  project: 'finos',
  name: 'git-proxy-test',
  url: 'https://github.com/finos/git-proxy-test.git',
};
const TEST_REPO = 'finos/git-proxy-test.git';
// user for test cases
const TEST_USER = 'testuser';
const TEST_PASSWORD = 'testpassword';
const TEST_EMAIL = 'jane.doe@email.com';
const TEST_GIT_ACCOUNT = 'testGitAccount';

const CLI_PATH = 'npx git-proxy-cli';

describe('test git-proxy-cli', function () {
  // *** help ***

  describe(`test git-proxy-cli :: help`, function () {
    it(`print help if no command or option is given`, async function () {
      const cli = `${CLI_PATH}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [
        'Commands:',
        'Options:',
        'You need at least one command before moving on',
      ];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it(`print help if invalid command or option is given`, async function () {
      const cli = `${CLI_PATH} invalid --invalid`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [
        'Commands:',
        'Options:',
        'Unknown arguments: invalid, invalid',
      ];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it(`print help if "--help" option is given`, async function () {
      const cli = `${CLI_PATH} invalid --help`;
      const expectedExitCode = 0;
      const expectedMessages = ['Commands:', 'Options:'];
      const expectedErrorMessages = null;
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });
  });

  // *** version ***

  describe(`test git-proxy-cli :: version`, function () {
    it(`"--version" option prints version details `, async function () {
      const cli = `${CLI_PATH} --version`;
      const expectedExitCode = 0;
      const packageJson = require('../../../package.json');
      const version = packageJson.version;
      const expectedMessages = [version];
      const expectedErrorMessages = null;
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });
  });

  // *** cofiguration ***

  describe('test git-proxy-cli :: configuration', function () {
    it(`"config" command prints configuration details`, async function () {
      const cli = `${CLI_PATH} config`;
      const expectedExitCode = 0;
      const expectedMessages = ['GitProxy URL:'];
      const expectedErrorMessages = null;
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });
  });

  // *** login ***

  describe('test git-proxy-cli :: login', function () {
    beforeAll(async function () {
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
    });

    afterAll(async function () {
      await helper.removeUserFromDb(TEST_USER);
    });

    it('login should fail when server is down', async function () {
      const username = 'admin';
      const password = 'admin';
      const cli = `${CLI_PATH} login --username ${username} --password ${password}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = [`Error: Login '${username}':`];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('login should fail with invalid credentials', async function () {
      const username = 'unkn0wn';
      const password = 'p4ssw0rd';
      const cli = `${CLI_PATH} login --username ${username} --password ${password}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [`Error: Login '${username}': '401'`];
      try {
        await helper.startServer();
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('login shoud be successful with valid credentials (admin)', async function () {
      const username = 'admin';
      const password = 'admin';
      const cli = `${CLI_PATH} login --username ${username} --password ${password}`;
      const expectedExitCode = 0;
      const expectedMessages = [`Login "${username}" <admin@place.com> (admin): OK`];
      const expectedErrorMessages = null;
      try {
        await helper.startServer();
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('login shoud be successful with valid credentials (non-admin)', async function () {
      const cli = `${CLI_PATH} login --username ${TEST_USER} --password ${TEST_PASSWORD}`;
      const expectedExitCode = 0;
      const expectedMessages = [`Login "${TEST_USER}" <${TEST_EMAIL}>: OK`];
      const expectedErrorMessages = null;
      try {
        await helper.startServer();
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** logout ***

  describe('test git-proxy-cli :: logout', function () {
    it('logout shoud succeed when server is down (and not logged in before)', async function () {
      await helper.removeCookiesFile();

      const cli = `${CLI_PATH} logout`;
      const expectedExitCode = 0;
      const expectedMessages = [`Logout: OK`];
      const expectedErrorMessages = null;
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('logout should succeed when server is down (but logged in before)', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const cli = `${CLI_PATH} logout`;
      const expectedExitCode = 0;
      const expectedMessages = [`Logout: OK`];
      const expectedErrorMessages = null;
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('logout should succeed when not authenticated (server is up)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();

        const cli = `${CLI_PATH} logout`;
        const expectedExitCode = 0;
        const expectedMessages = [`Logout: OK`];
        const expectedErrorMessages = null;
        await helper.startServer();
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('logout shoud be successful when authenticated (server is up)', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} logout`;
        const expectedExitCode = 0;
        const expectedMessages = [`Logout: OK`];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** authorise ***

  describe('test git-proxy-cli :: authorise', function () {
    const pushId = `auth000000000000000000000000000000000000__${Date.now()}`;

    beforeAll(async function () {
      await helper.addRepoToDb(TEST_REPO_CONFIG);
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
      await helper.addGitPushToDb(pushId, TEST_REPO_CONFIG.url, TEST_USER, TEST_EMAIL);
    });

    afterAll(async function () {
      await helper.removeGitPushFromDb(pushId);
      await helper.removeUserFromDb(TEST_USER);
      await helper.removeRepoFromDb(TEST_REPO_CONFIG.url);
    });

    it('attempt to authorise should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} authorise --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Authorise:'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to authorise should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} authorise --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Authorise: Authentication required'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to authorise should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer();
        const id = pushId;
        const cli = `${CLI_PATH} authorise --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: Authorise: Authentication required'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to authorise should fail when git push ID not found', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const id = GHOST_PUSH_ID;
        const cli = `${CLI_PATH} authorise --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [`Error: Authorise: ID: '${id}': Not Found`];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** cancel ***

  describe('test git-proxy-cli :: cancel', function () {
    const pushId = `cancel0000000000000000000000000000000000__${Date.now()}`;

    beforeAll(async function () {
      await helper.addRepoToDb(TEST_REPO_CONFIG);
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
      await helper.addGitPushToDb(pushId, TEST_USER, TEST_EMAIL, TEST_REPO);
    });

    afterAll(async function () {
      await helper.removeGitPushFromDb(pushId);
      await helper.removeUserFromDb(TEST_USER);
      await helper.removeRepoFromDb(TEST_REPO_CONFIG.url);
    });

    it('attempt to cancel should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} cancel --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Cancel:'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to cancel should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} cancel --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Cancel: Authentication required'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to cancel should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer();
        const id = pushId;
        const cli = `${CLI_PATH} cancel --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: Cancel: Authentication required'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
        // });
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to cancel should fail when git push ID not found', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const id = GHOST_PUSH_ID;
        const cli = `${CLI_PATH} cancel --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [`Error: Cancel: ID: '${id}': Not Found`];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** ls ***

  describe('test git-proxy-cli :: ls (list)', function () {
    it('attempt to ls should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const cli = `${CLI_PATH} ls`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: List:'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to ls should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const cli = `${CLI_PATH} ls`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: List: Authentication required'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to ls should fail when invalid option given', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --invalid`;
        const expectedExitCode = 1;
        const expectedMessages = null;
        const expectedErrorMessages = ['Options:', 'Unknown argument: invalid'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** reject ***

  describe('test git-proxy-cli :: reject', function () {
    const pushId = `reject0000000000000000000000000000000000__${Date.now()}`;

    beforeAll(async function () {
      await helper.addRepoToDb(TEST_REPO_CONFIG);
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
      await helper.addGitPushToDb(pushId, TEST_REPO_CONFIG.url, TEST_USER, TEST_EMAIL);
    });

    afterAll(async function () {
      await helper.removeGitPushFromDb(pushId);
      await helper.removeUserFromDb(TEST_USER);
      await helper.removeRepoFromDb(TEST_REPO_CONFIG.url);
    });

    it('attempt to reject should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} reject --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Reject:'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to reject should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `${CLI_PATH} reject --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Reject: Authentication required'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to reject should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer();
        const id = pushId;
        const cli = `${CLI_PATH} reject --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: Reject: Authentication required'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to reject should fail when git push ID not found', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const id = GHOST_PUSH_ID;
        const cli = `${CLI_PATH} reject --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [`Error: Reject: ID: '${id}': Not Found`];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });
  });

  // *** create user ***

  describe('test git-proxy-cli :: create-user', function () {
    beforeAll(async function () {
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
    });

    afterAll(async function () {
      await helper.removeUserFromDb(TEST_USER);
    });

    it('attempt to create user should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);
      } finally {
        await helper.closeServer();
      }

      const cli = `${CLI_PATH} create-user --username newuser --password newpass --email new@email.com --gitAccount newgit`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Create User:'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to create user should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const cli = `${CLI_PATH} create-user --username newuser --password newpass --email new@email.com --gitAccount newgit`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Create User: Authentication required'];
      await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
    });

    it('attempt to create user should fail when not admin', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username testuser --password testpassword`);

        const cli = `${CLI_PATH} create-user --username newuser --password newpass --email new@email.com --gitAccount newgit`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: Create User: Authentication required'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to create user should fail with missing required fields', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} create-user --username newuser --password "" --email new@email.com --gitAccount newgit`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: Create User: Missing required fields'];
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('should successfully create a new user', async function () {
      const uniqueUsername = `newuser_${Date.now()}`;
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} create-user --username ${uniqueUsername} --password newpass --email ${uniqueUsername}@email.com --gitAccount newgit`;
        const expectedExitCode = 0;
        const expectedMessages = [`User '${uniqueUsername}' created successfully`];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        // Verify we can login with the new user
        await helper.runCli(
          `${CLI_PATH} login --username ${uniqueUsername} --password newpass`,
          0,
          [`Login "${uniqueUsername}" <${uniqueUsername}@email.com>: OK`],
          null,
        );
      } finally {
        await helper.closeServer();
        // Clean up the created user
        try {
          await helper.removeUserFromDb(uniqueUsername);
        } catch (error: unknown) {
          handleAndLogError(error, 'Error cleaning up user');
        }
      }
    });

    it('should successfully create a new admin user', async function () {
      const uniqueUsername = `newadmin_${Date.now()}`;
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} create-user --username ${uniqueUsername} --password newpass --email ${uniqueUsername}@email.com --gitAccount newgit --admin`;
        const expectedExitCode = 0;
        const expectedMessages = [`User '${uniqueUsername}' created successfully`];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        // Verify we can login with the new admin user
        await helper.runCli(
          `${CLI_PATH} login --username ${uniqueUsername} --password newpass`,
          0,
          [`Login "${uniqueUsername}" <${uniqueUsername}@email.com> (admin): OK`],
          null,
        );
      } finally {
        await helper.closeServer();
        // Clean up the created user
        try {
          await helper.removeUserFromDb(uniqueUsername);
        } catch (error: unknown) {
          handleAndLogError(error, 'Error cleaning up user');
        }
      }
    });
  });

  // *** tests require push in db ***

  describe('test git-proxy-cli :: git push administration', function () {
    const pushId = `0000000000000000000000000000000000000000__${Date.now()}`;

    beforeAll(async function () {
      await helper.addRepoToDb(TEST_REPO_CONFIG);
      await helper.addUserToDb(TEST_USER, TEST_PASSWORD, TEST_EMAIL, TEST_GIT_ACCOUNT);
      await helper.addGitPushToDb(pushId, TEST_REPO_CONFIG.url, TEST_USER, TEST_EMAIL);
    });

    afterAll(async function () {
      await helper.removeGitPushFromDb(pushId);
      await helper.removeUserFromDb(TEST_USER);
      await helper.removeRepoFromDb(TEST_REPO_CONFIG.url);
    });

    it('attempt to ls should list existing push', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --authorised false --blocked true --canceled false --rejected false`;
        const expectedExitCode = 0;
        const expectedMessages = [
          pushId,
          TEST_REPO,
          'authorised: false',
          'blocked: true',
          'canceled: false',
          'error: false',
          'rejected: false',
        ];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to ls should not list existing push when filtered for authorised', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --authorised true`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to ls should not list existing push when filtered for canceled', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --canceled true`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to ls should not list existing push when filtered for rejected', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --rejected true`;
        const expectedExitCode = 0;
        const expectedMessages: string[] | null = null;
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('attempt to ls should not list existing push when filtered for non-blocked', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        const cli = `${CLI_PATH} ls --blocked false`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('authorise push and test if appears on authorised list', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        let cli = `${CLI_PATH} ls --authorised true --canceled false --rejected false`;
        let expectedExitCode = 0;
        let expectedMessages = ['[]'];
        let expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} authorise --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Authorise: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} ls --authorised true --canceled false --rejected false`;
        expectedExitCode = 0;
        expectedMessages = [pushId, TEST_REPO];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('reject push and test if appears on rejected list', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        let cli = `${CLI_PATH} ls --authorised false --canceled false --rejected true`;
        let expectedExitCode = 0;
        let expectedMessages: string[] | null = null;
        let expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} reject --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Reject: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} ls --authorised false --canceled false --rejected true`;
        expectedExitCode = 0;
        expectedMessages = [pushId, TEST_REPO];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
      }
    });

    it('cancel push and test if appears on canceled list', async function () {
      try {
        await helper.startServer();
        await helper.runCli(`${CLI_PATH} login --username admin --password admin`);

        let cli = `${CLI_PATH} ls --authorised false --canceled true --rejected false`;
        let expectedExitCode = 0;
        let expectedMessages = ['[]'];
        let expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} cancel --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Cancel: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);

        cli = `${CLI_PATH} ls --authorised false --canceled true --rejected false`;
        expectedExitCode = 0;
        expectedMessages = [pushId, TEST_REPO];
        expectedErrorMessages = null;
        await helper.runCli(cli, expectedExitCode, expectedMessages, expectedErrorMessages);
      } finally {
        await helper.closeServer();
        await helper.removeCookiesFile();
      }
    });
  });
});
