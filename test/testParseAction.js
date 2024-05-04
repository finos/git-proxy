/* eslint-disable max-len */
const chai = require('chai');
const { Repo } = require('../src/model');
const getRepoFromUrlPath = require('../src/proxy/processors/pre-processor/parseAction').getRepoFromUrlPath;

chai.should();

const expect = chai.expect;

describe('utility functions for pre-processors ', function () {
  it('getRepoFromUrlPath should return NOT-FOUND for invalid repo urls', function () {
    const invalidRepoUrls = [
      '',
      '/info/refs?service=git-upload-pack',
      '/finos/git-proxy-test.git/info/refs?service=git-receive-pack',
      '/git-upload-pack',
    ];
    for (const invalidRepoUrl of invalidRepoUrls) {
      expect(getRepoFromUrlPath(invalidRepoUrl)).to.equal('NOT-FOUND');
    }
  });

  it('getRepoFromUrlPath should return an instance of Repo for invalid repo urls', function () {
    const validRepoUrls = [
      '/gitlab.com/finos/git-proxy-test.git/info/refs?service=git-receive-pack',
      '/github.com/finos/git-proxy-test.git/git-upload-pack',
    ];
    for (const validRepoUrl of validRepoUrls) {
      expect(getRepoFromUrlPath(validRepoUrl)).be.instanceOf(Repo);
    }
  });
});
