// Import the dependencies for testing
const chaiExec = require("@jsdevtools/chai-exec");
const chai = require('chai');
const service = require('../../../src/service');
const util = require("util")

chai.use(chaiExec);
const expect = chai.expect;

chaiExec.defaults = {
  options: {
    timeout: 10000 // fail test case if server hangs
  }
};

describe('test git-proxy-cli', async () => {
  let app;

  before(async function () {
//    app = await service.start();
//    console.log("");
  });

  describe('test git-proxy-cli :: login', async function () {
    it('login shoud fail with invalid credentials', async function () {
      let username = "unkn0wn"
      let password = "p4ssw0rd"
      let cli = chaiExec(`npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`);
      expect(cli).to.exit.with.code(2);
    });
    it('login shoud be successful with valid (default) admin credentials', async function () {
      let username = "admin"
      let password = "admin"
      let cli = chaiExec(`npx -- @finos/git-proxy-cli login --username ${username} --password ${password}`);
      expect(cli).to.exit.with.code(0);
    });
  });

  describe('test git-proxy-cli :: approve commit', async function () {
    it('attempt to approve non-existing commit should return exit code 3', async function () {            
      let commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
      cli = chaiExec(`npx -- @finos/git-proxy-cli approve --commitId ${commitId}`);
      expect(cli).to.exit.with.code(3);
    });
  });

  describe('test git-proxy-cli :: logout', async function () {
    it('attempt to log out should be successful', async function () {            
      cli = chaiExec(`npx -- @finos/git-proxy-cli logout`);
      expect(cli).to.exit.with.code(0);
    });
  });
  after(async function () {
//    await service.httpServer.close();
  });
});
