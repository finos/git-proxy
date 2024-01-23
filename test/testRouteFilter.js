/* eslint-disable max-len */
const chai = require('chai');
const allowedContentType = require('../src/proxy/routes').allowedContentType;
const allowedUrl = require('../src/proxy/routes').allowedUrl;
const allowedUserAgent = require('../src/proxy/routes').allowedUserAgent;

chai.should();

const expect = chai.expect;

describe('url filters for proxying ', function () {
  it('allowedUrls should return true for safe URLs', function () {
    expect(
      allowedUrl('/octocat/hello-world.git/info/refs?service=git-upload-pack'),
    ).true;
    expect(allowedUrl('/octocat/hello-world.git/git-upload-pack')).true;
    expect(allowedUrl('/octocat/hello-world/info/refs?service=git-upload-pack'))
      .true;
    expect(allowedUrl('/octocat/hello-world/git-upload-pack')).true;
  });

  it('allowedUrls should return false for unsafe URLs', function () {
    expect(allowedUrl('/octocat/hello-world.git/foo/bar/baz')).false;
  });

  it('allowedUserAgent should return true for safe user-agent', function () {
    expect(allowedUserAgent('git/2.40.0')).true;
  });

  it('allowedUserAgent should return false for other user-agents', function () {
    expect(allowedUserAgent('Mozilla/5.0')).true;
  });

  it('allowedContentType should return true for safe content-type', function () {
    expect(allowedContentType('application/x-git-upload-pack-request')).true;
    expect(allowedContentType('application/x-git-receive-pack-request')).true;
  });

  it('allowedContentType should return false for other content-type', function () {
    expect(allowedContentType('application/json')).false;
    expect(allowedContentType('text/html')).true;
  });
});
