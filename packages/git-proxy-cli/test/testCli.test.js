/* eslint-disable max-len */
const helper = require('./testCliUtils');

const path = require('path');

// set test proxy config file path *before* loading the proxy
require('../../../src/config/file').configFile = path.join(
  process.cwd(),
  'test',
  'testCli.proxy.config.json',
);
const service = require('../../../src/service');

/* test constants */
// push ID which does not exist
const GHOST_PUSH_ID =
  '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';

describe('test git-proxy-cli', function () {
  // *** help ***

  describe(`test git-proxy-cli :: help`, function () {
    it(`print help if no command or option is given`, async function () {
      const cli = `npx -- @finos/git-proxy-cli`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [
        'Commands:',
        'Options:',
        'You need at least one command before moving on',
      ];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it(`print help if invalid command or option is given`, async function () {
      const cli = `npx -- @finos/git-proxy-cli invalid --invalid`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [
        'Commands:',
        'Options:',
        'Unknown arguments: invalid, invalid',
      ];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it(`print help if "--help" option is given`, async function () {
      const cli = `npx -- @finos/git-proxy-cli invalid --help`;
      const expectedExitCode = 0;
      const expectedMessages = ['Commands:', 'Options:'];
      const expectedErrorMessages = null;
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });
  });

  // *** version ***

  describe(`test git-proxy-cli :: version`, function () {
    it(`"--version" option prints version details `, async function () {
      const cli = `npx -- @finos/git-proxy-cli --version`;
      const expectedExitCode = 0;
      const expectedMessages = ['0.1.0'];
      const expectedErrorMessages = null;
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });
  });

  // *** cofiguration ***

  describe('test git-proxy-cli :: configuration', function () {
    it(`"config" command prints configuration details`, async function () {
      const cli = `npx -- @finos/git-proxy-cli config`;
      const expectedExitCode = 0;
      const expectedMessages = ['GitProxy URL:'];
      const expectedErrorMessages = null;
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });
  });

  // *** login ***

  describe('test git-proxy-cli :: login', function () {
    const testUser = 'testuser';
    const testPassword = 'testpassword';
    const testEmail = 'jane.doe@email.com';

    before(async function () {
      await helper.addUserToDb(
        testUser,
        testPassword,
        testEmail,
        'testGitAccount',
      );
    });

    it('login shoud fail when server is down', async function () {
      const username = 'admin';
      const password = 'admin';
      const cli = `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = [`Error: Login '${username}':`];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('login shoud fail with invalid credentials', async function () {
      const username = 'unkn0wn';
      const password = 'p4ssw0rd';
      const cli = `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [`Error: Login '${username}': '401'`];
      try {
        await helper.startServer(service);
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('login shoud be successful with valid credentials (admin)', async function () {
      const username = 'admin';
      const password = 'admin';
      const cli = `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`;
      const expectedExitCode = 0;
      const expectedMessages = [
        `Login "${username}" <admin@place.com> (admin): OK`,
      ];
      const expectedErrorMessages = null;
      try {
        await helper.startServer(service);
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('login shoud be successful with valid credentials (non-admin)', async function () {
      const cli = `npx -- @finos/git-proxy-cli login --username ${testUser} --password ${testPassword}`;
      const expectedExitCode = 0;
      const expectedMessages = [`Login "${testUser}" <${testEmail}>: OK`];
      const expectedErrorMessages = null;
      try {
        await helper.startServer(service);
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** logout ***

  describe('test git-proxy-cli :: logout', function () {
    it('logout shoud succeed when server is down (and not logged in before)', async function () {
      await helper.removeCookiesFile();

      const cli = `npx -- @finos/git-proxy-cli logout`;
      const expectedExitCode = 0;
      const expectedMessages = [`Logout: OK`];
      const expectedErrorMessages = null;
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('logout should succeed when server is down (but logged in before)', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }

      const cli = `npx -- @finos/git-proxy-cli logout`;
      const expectedExitCode = 0;
      const expectedMessages = [`Logout: OK`];
      const expectedErrorMessages = null;
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('logout should succeed when not authenticated (server is up)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();

        const cli = `npx -- @finos/git-proxy-cli logout`;
        const expectedExitCode = 0;
        const expectedMessages = [`Logout: OK`];
        const expectedErrorMessages = null;
        await helper.startServer(service);
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('logout shoud be successful when authenticated (server is up)', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli logout`;
        const expectedExitCode = 0;
        const expectedMessages = [`Logout: OK`];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** authorise ***

  describe('test git-proxy-cli :: authorise', function () {
    it('attempt to authorise should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli authorise --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Authorise:'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to authorise should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli authorise --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = [
        'Error: Authorise: Authentication required',
      ];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to authorise should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer(service);
        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli authorise --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = [
          'Error: Authorise: Authentication required',
        ];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to authorise should fail when git push ID not found', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli authorise --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [
          `Error: Authorise: ID: '${id}': Not Found`,
        ];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** cancel ***

  describe('test git-proxy-cli :: cancel', function () {
    it('attempt to cancel should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli cancel --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Cancel:'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to cancel should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli cancel --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Cancel: Authentication required'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to cancel should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer(service);
        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli cancel --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = [
          'Error: Cancel: Authentication required',
        ];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
        // });
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to cancel should fail when git push ID not found', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli cancel --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [`Error: Cancel: ID: '${id}': Not Found`];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** ls ***

  describe('test git-proxy-cli :: ls (list)', function () {
    it('attempt to ls should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }

      const cli = `npx -- @finos/git-proxy-cli ls`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: List:'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to ls should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const cli = `npx -- @finos/git-proxy-cli ls`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: List: Authentication required'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to ls should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer(service);
        const cli = `npx -- @finos/git-proxy-cli ls`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = ['Error: List: Authentication required'];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to ls should fail when invalid option given', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --invalid`;
        const expectedExitCode = 1;
        const expectedMessages = null;
        const expectedErrorMessages = ['Options:', 'Unknown argument: invalid'];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** reject ***

  describe('test git-proxy-cli :: reject', function () {
    it('attempt to reject should fail when server is down', async function () {
      try {
        // start server -> login -> stop server
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli reject --id ${id}`;
      const expectedExitCode = 2;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Reject:'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to reject should fail when not authenticated', async function () {
      await helper.removeCookiesFile();

      const id = GHOST_PUSH_ID;
      const cli = `npx -- @finos/git-proxy-cli reject --id ${id}`;
      const expectedExitCode = 1;
      const expectedMessages = null;
      const expectedErrorMessages = ['Error: Reject: Authentication required'];
      await helper.runCli(
        cli,
        expectedExitCode,
        expectedMessages,
        expectedErrorMessages,
      );
    });

    it('attempt to reject should fail when not authenticated (server restarted)', async function () {
      try {
        await helper.createCookiesFileWithExpiredCookie();
        await helper.startServer(service);
        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli reject --id ${id}`;
        const expectedExitCode = 3;
        const expectedMessages = null;
        const expectedErrorMessages = [
          'Error: Reject: Authentication required',
        ];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to reject should fail when git push ID not found', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const id = GHOST_PUSH_ID;
        const cli = `npx -- @finos/git-proxy-cli reject --id ${id}`;
        const expectedExitCode = 4;
        const expectedMessages = null;
        const expectedErrorMessages = [`Error: Reject: ID: '${id}': Not Found`];
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });
  });

  // *** tests require push in db ***

  describe('test git-proxy-cli :: git push administration', function () {
    const pushId = `0000000000000000000000000000000000000000__${Date.now()}`;
    const repo = 'test-repo';

    before(async function () {
      await helper.addGitPushToDb(pushId, repo);
    });

    it('attempt to ls should list existing push', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --authorised false --blocked true --canceled false --rejected false`;
        const expectedExitCode = 0;
        const expectedMessages = [
          pushId,
          repo,
          'authorised: false',
          'blocked: true',
          'canceled: false',
          'error: false',
          'rejected: false',
        ];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to ls should not list existing push when filtered for authorised', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --authorised true`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to ls should not list existing push when filtered for canceled', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --canceled true`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to ls should not list existing push when filtered for rejected', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --rejected true`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('attempt to ls should not list existing push when filtered for non-blocked', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        const cli = `npx -- @finos/git-proxy-cli ls --blocked false`;
        const expectedExitCode = 0;
        const expectedMessages = ['[]'];
        const expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('authorise push and test if appears on authorised list', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        let cli = `npx -- @finos/git-proxy-cli ls --authorised true --canceled false --rejected false`;
        let expectedExitCode = 0;
        let expectedMessages = ['[]'];
        let expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli authorise --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Authorise: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli ls --authorised true --canceled false --rejected false`;
        expectedExitCode = 0;
        expectedMessages = [pushId, repo];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('reject push and test if appears on rejected list', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        let cli = `npx -- @finos/git-proxy-cli ls --authorised false --canceled false --rejected true`;
        let expectedExitCode = 0;
        let expectedMessages = ['[]'];
        let expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli reject --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Reject: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli ls --authorised false --canceled false --rejected true`;
        expectedExitCode = 0;
        expectedMessages = [pushId, repo];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
      }
    });

    it('cancel push and test if appears on canceled list', async function () {
      try {
        await helper.startServer(service);
        await helper.runCli(
          `npx -- @finos/git-proxy-cli login --username admin --password admin`,
        );

        let cli = `npx -- @finos/git-proxy-cli ls --authorised false --canceled true --rejected false`;
        let expectedExitCode = 0;
        let expectedMessages = ['[]'];
        let expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli cancel --id ${pushId}`;
        expectedExitCode = 0;
        expectedMessages = [`Cancel: ID: '${pushId}': OK`];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );

        cli = `npx -- @finos/git-proxy-cli ls --authorised false --canceled true --rejected false`;
        expectedExitCode = 0;
        expectedMessages = [pushId, repo];
        expectedErrorMessages = null;
        await helper.runCli(
          cli,
          expectedExitCode,
          expectedMessages,
          expectedErrorMessages,
        );
      } finally {
        await helper.closeServer(service.httpServer);
        await helper.removeCookiesFile();
      }
    });
  });
});
