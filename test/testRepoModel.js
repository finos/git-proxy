// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const { Repo } = require('../src/model');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('model', async () => {

  before(async function () {
  });

  describe('model: Repo', async function () {
    it('valid repo urls should pass', async function () {
      const validRepoUrls = [
        "https://github.com/finos/proxy.git",
        "https://github.com/finos/git-proxy.git",
        "https://gitlab.com/finos/git-proxy.git",
        "https://github.com/Citi/citi-ospo.git",
        "https://github.com/RBC/finos-traderX.git/",
        "https://gitlab.com/me-msagi.dev/git-proxy-test.git/"
      ];

      for (const url of validRepoUrls) {
        expect(new Repo(url)).to.be.an("object");
      }
    });


    it('invalid repo urls should throw error', async function () {
      const invalidRepoUrls = [
        null,
        "https://github.com/finos/proxy",
        "http://github.com/finos/git-proxy.git",
        "https://bitbucket.com/finos/git-proxy.git",
        "https://github/Citi/citi-ospo.git",
        "https://github.com/RBC/finos-traderX.git//"
      ];

      for (const url of invalidRepoUrls) {
        expect(function(){new Repo(url);}).to.throw();
      }
    });
  });

  after(async function () {
  });
});
