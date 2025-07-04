/* eslint-disable max-len */
import * as chai from 'chai';
import {
  validGitRequest,
  processUrlPath,
  processGitUrl,
  processGitURLForNameAndOrg,
} from '../src/proxy/routes/helper';

chai.should();

const expect = chai.expect;

const VERY_LONG_PATH =
  '/a/very/very/very/very/very//very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/long/path';

describe('url helpers and filter functions used in the proxy', function () {
  it('processUrlPath should return breakdown of a proxied path, separating the path to repository from the git operation path', function () {
    expect(
      processUrlPath('/github.com/octocat/hello-world.git/info/refs?service=git-upload-pack'),
    ).to.deep.eq({
      repoPath: '/github.com/octocat/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });

    expect(
      processUrlPath('/gitlab.com/org/sub-org/hello-world.git/info/refs?service=git-upload-pack'),
    ).to.deep.eq({
      repoPath: '/gitlab.com/org/sub-org/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });

    expect(
      processUrlPath('/123.456.789/hello-world.git/info/refs?service=git-upload-pack'),
    ).to.deep.eq({
      repoPath: '/123.456.789/hello-world.git',
      gitPath: '/info/refs?service=git-upload-pack',
    });
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository from the git operation path', function () {
    expect(processUrlPath('/octocat/hello-world.git/info/refs?service=git-upload-pack')).to.deep.eq(
      { repoPath: '/octocat/hello-world.git', gitPath: '/info/refs?service=git-upload-pack' },
    );
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository when git path is just /', function () {
    expect(processUrlPath('/octocat/hello-world.git/')).to.deep.eq({
      repoPath: '/octocat/hello-world.git',
      gitPath: '/',
    });
  });

  it('processUrlPath should return breakdown of a legacy proxy path, separating the path to repository when no path is present', function () {
    expect(processUrlPath('/octocat/hello-world.git')).to.deep.eq({
      repoPath: '/octocat/hello-world.git',
      gitPath: '/',
    });
  });

  it("processUrlPath should return null if the url couldn't be parsed", function () {
    expect(processUrlPath('/octocat/hello-world')).to.be.null;
    expect(processUrlPath(VERY_LONG_PATH)).to.be.null;
  });

  it('processGitUrl should return breakdown of a git URL separating out the protocol, host and repository path', function () {
    expect(processGitUrl('https://somegithost.com/octocat/hello-world.git')).to.deep.eq({
      protocol: 'https://',
      host: 'somegithost.com',
      repoPath: '/octocat/hello-world.git',
    });

    expect(processGitUrl('https://123.456.789:1234/hello-world.git')).to.deep.eq({
      protocol: 'https://',
      host: '123.456.789:1234',
      repoPath: '/hello-world.git',
    });
  });

  it('processGitUrl should return breakdown of a git URL separating out the protocol, host and repository path and discard any git operation path', function () {
    expect(
      processGitUrl(
        'https://somegithost.com:1234/octocat/hello-world.git/info/refs?service=git-upload-pack',
      ),
    ).to.deep.eq({
      protocol: 'https://',
      host: 'somegithost.com:1234',
      repoPath: '/octocat/hello-world.git',
    });

    expect(
      processGitUrl('https://123.456.789/hello-world.git/info/refs?service=git-upload-pack'),
    ).to.deep.eq({
      protocol: 'https://',
      host: '123.456.789',
      repoPath: '/hello-world.git',
    });
  });

  it('processGitUrl should return null for a url it cannot parse', function () {
    expect(processGitUrl('somegithost.com:1234/octocat/hello-world.git')).to.be.null;
    expect(processUrlPath('somegithost.com:1234' + VERY_LONG_PATH + '.git')).to.be.null;
  });

  it('processGitURLForNameAndOrg should return breakdown of a git URL path separating out the protocol, origin and repository path', function () {
    expect(processGitURLForNameAndOrg('github.com/octocat/hello-world.git')).to.deep.eq({
      project: 'octocat',
      repoName: 'hello-world.git',
    });
  });

  it('processGitURLForNameAndOrg should return breakdown of a git repository URL separating out the project (organisation) and repository name', function () {
    expect(processGitURLForNameAndOrg('https://github.com:80/octocat/hello-world.git')).to.deep.eq({
      project: 'octocat',
      repoName: 'hello-world.git',
    });
  });

  it("processGitURLForNameAndOrg should return null for a git repository URL it can't pass", function () {
    expect(processGitURLForNameAndOrg('someGitHost.com/repo')).to.be.null;
    expect(processGitURLForNameAndOrg('https://someGitHost.com/repo')).to.be.null;
    expect(processGitURLForNameAndOrg('https://somegithost.com:1234' + VERY_LONG_PATH + '.git')).to
      .be.null;
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
