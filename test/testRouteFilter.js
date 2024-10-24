/* eslint-disable max-len */
const chai = require('chai');
const validGitRequest = require('../src/proxy/routes').validGitRequest;
const stripGitHubFromGitPath = require('../src/proxy/routes').stripGitHubFromGitPath;

chai.should();

const expect = chai.expect;

describe('url filters for proxying ', function () {
  it('stripGitHubFromGitPath should return the sanitized URL with owner & repo removed', function () {
    expect(stripGitHubFromGitPath('/octocat/hello-world.git/info/refs?service=git-upload-pack')).eq(
      '/info/refs?service=git-upload-pack',
    );
  });

  it('stripGitHubFromGitPath should return undefined if the url', function () {
    expect(stripGitHubFromGitPath('/octocat/hello-world')).undefined;
  });

  it('validGitRequest should return true for safe requests on expected URLs', function () {
    [
      '/info/refs?service=git-upload-pack',
      '/info/refs?service=git-receive-pack',
      '/git-upload-pack',
      '/git-receive-pack',
    ].forEach((url) => {
      expect(
        validGitRequest(url, {
          'user-agent': 'git/2.30.0',
          accept: 'application/x-git-upload-pack-request',
        }),
      ).true;
    });
  });

  it('validGitRequest should return false for unsafe URLs', function () {
    ['/', '/foo'].forEach((url) => {
      expect(
        validGitRequest(url, {
          'user-agent': 'git/2.30.0',
          accept: 'application/x-git-upload-pack-request',
        }),
      ).false;
    });
  });

  it('validGitRequest should return false for a browser request', function () {
    expect(
      validGitRequest('/', {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      }),
    ).false;
  });

  it('validGitRequest should return false for unexpected combinations of headers & URLs', function () {
    // expected Accept=application/x-git-upload-pack
    expect(
      validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.30.0',
        accept: '*/*',
      }),
    ).false;

    // expected User-Agent=git/*
    expect(
      validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'Mozilla/5.0',
        accept: '*/*',
      }),
    ).false;
  });

  it('validGitRequest should return false for unexpected content-type on certain URLs', function () {
    ['application/json', 'text/html', '*/*'].map((accept) => {
      expect(
        validGitRequest('/git-upload-pack', {
          'user-agent': 'git/2.30.0',
          accept: accept,
        }),
      ).false;
    });
  });
});
