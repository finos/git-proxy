/* eslint-disable max-len */
const chai = require('chai');
const validGitRequest = require('../src/proxy/routes').validGitRequest;

chai.should();

const expect = chai.expect;

describe('url filters for proxying ', function () {
  it('validGitRequest should return true for safe requests on expected URLs', function () {
    [
      '/octocat/hello-world.git/info/refs?service=git-upload-pack',
      '/octocat/hello-world.git/info/refs?service=git-receive-pack',
      '/octocat/hello-world.git/git-upload-pack',
      '/octocat/hello-world.git/git-receive-pack',
    ]
      .map((url) => {
        return {
          headers: {
            'user-agent': 'git/2.30.0',
            accept: 'application/x-git-upload-pack-request',
          },
          url: url,
        };
      })
      .forEach((req) => {
        expect(validGitRequest(req)).true;
      });
  });

  it('validGitRequest should return false for unsafe URLs', function () {
    const req = {
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      },
      url: '/',
    };
    expect(validGitRequest(req)).false;
  });

  it('validGitRequest should return false for other user-agents', function () {
    const req = {
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      },
      url: '/octocat/hello-world',
    };
    expect(validGitRequest(req)).false;
  });

  it('validGitRequest should return false for unexpected content-type on certain URLs', function () {
    ['application/json', 'text/html', '*/*']
      .map((accept) => {
        return {
          headers: {
            'user-agent': 'git/2.30.0',
            accept: accept,
          },
          url: '/octocat/hello-world.git/git-upload-pack',
        };
      })
      .forEach((req) => {
        expect(validGitRequest(req)).false;
      });
  });
});
