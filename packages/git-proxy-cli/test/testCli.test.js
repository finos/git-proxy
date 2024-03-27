/* eslint-disable max-len */
// Import the dependencies for testing
const { chaiExecAsync } = require('@jsdevtools/chai-exec');
const chai = require('chai');
const service = require('../../../src/service');

chai.use(chaiExecAsync);
const expect = chai.expect;

chaiExecAsync.defaults = {
  options: {
    timeout: 30000, // fail test case if server hangs
  },
};

describe('test git-proxy-cli', async () => {
  before(async function () {
    await service.start();
  });

  describe('test git-proxy-cli :: login', async function () {
    it('login shoud fail with invalid credentials', async function () {
      const username = 'unkn0wn';
      const password = 'p4ssw0rd';
      const cli = await chaiExecAsync(
        `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`,
      );
      expect(cli).to.exit.with.code(1);
    });

    it('login shoud be successful with valid (default) admin credentials', async function () {
      // eslint-disable-line max-len
      const username = 'admin';
      const password = 'admin';
      const cli = await chaiExecAsync(
        `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`,
      );
      expect(cli).to.exit.with.code(0);
    });
  });

  describe('test git-proxy-cli :: approve commit', async function () {
    it('attempt to approve non-existing commit should return exit code 3', async function () {
      // eslint-disable-line max-len
      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';
      const cli = await chaiExecAsync(
        `npx -- @finos/git-proxy-cli approve --commitId ${commitId}`,
      );
      expect(cli).to.exit.with.code(3);
    });
  });

  describe('test git-proxy-cli :: logout', async function () {
    it('attempt to log out should be successful', async function () {
      const cli = await chaiExecAsync(`npx -- @finos/git-proxy-cli logout`);
      expect(cli).to.exit.with.code(0);
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
