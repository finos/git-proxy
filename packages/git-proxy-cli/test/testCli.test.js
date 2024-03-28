/* eslint-disable max-len */
const { expect } = require('chai');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const service = require('../../../src/service');

describe('test git-proxy-cli', async () => {
  before(async function () {
    await service.start();
  });

  describe('test git-proxy-cli :: login', async function () {
    it('login shoud fail with invalid credentials', async function () {
      const username = 'unkn0wn';
      const password = 'p4ssw0rd';
      const cli = `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`;
      const expectedExitCode = 1;
      try {
        await execAsync(cli);
        expect(0).to.equal(expectedExitCode);
      } catch (error) {
        const exitCode = error.code;
        expect(exitCode).to.equal(expectedExitCode);
      }
    });

    it('login shoud be successful with valid (default) admin credentials', async function () {
      const username = 'admin';
      const password = 'admin';
      const cli = `npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`;
      const expectedExitCode = 0;
      try {
        await execAsync(cli);
        expect(0).to.equal(expectedExitCode);
      } catch (error) {
        const exitCode = error.code;
        expect(exitCode).to.equal(expectedExitCode);
      }
    });
  });

  describe('test git-proxy-cli :: approve commit', async function () {
    it('attempt to approve non-existing commit should return exit code 3', async function () {
      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';
      const cli = `npx -- @finos/git-proxy-cli approve --commitId ${commitId}`;
      const expectedExitCode = 3;
      try {
        await execAsync(cli);
        expect(0).to.equal(expectedExitCode);
      } catch (error) {
        const exitCode = error.code;
        expect(exitCode).to.equal(expectedExitCode);
      }
    });
  });

  describe('test git-proxy-cli :: logout', async function () {
    it('attempt to log out should be successful', async function () {
      const cli = `npx -- @finos/git-proxy-cli logout`;
      const expectedExitCode = 0;
      try {
        await execAsync(cli);
        expect(0).to.equal(expectedExitCode);
      } catch (error) {
        const exitCode = error.code;
        expect(exitCode).to.equal(expectedExitCode);
      }
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
