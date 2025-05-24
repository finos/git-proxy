const { handleMessage, validGitRequest, stripGitHubFromGitPath } = require('../src/proxy/routes');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const proxyRouter = require('../src/proxy/routes').router;
const chain = require('../src/proxy/chain');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('proxy route filter middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/', proxyRouter);
  });

  afterEach(() => {
    sinon.restore();
  });

  });
});

describe('proxy route helpers', () => {
  describe('handleMessage', async () => {
    it('should handle short messages', async function () {
      const res = await handleMessage('one');
      expect(res).to.contain('one');
    });

    it('should handle emoji messages', async function () {
      const res = await handleMessage('❌ push failed: too many errors');
      expect(res).to.contain('❌');
    });
  });

  describe('validGitRequest', () => {
    it('should return true for /info/refs?service=git-upload-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'git/2.30.1',
      });
      expect(res).to.be.true;
    });
  
    it('should return true for /info/refs?service=git-receive-pack with valid user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-receive-pack', {
        'user-agent': 'git/1.9.1',
      });
      expect(res).to.be.true;
    });
  
    it('should return false for /info/refs?service=git-upload-pack with missing user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {});
      expect(res).to.be.false;
    });
  
    it('should return false for /info/refs?service=git-upload-pack with non-git user-agent', () => {
      const res = validGitRequest('/info/refs?service=git-upload-pack', {
        'user-agent': 'curl/7.79.1',
      });
      expect(res).to.be.false;
    });
  
    it('should return true for /git-upload-pack with valid user-agent and accept', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).to.be.true;
    });
  
    it('should return false for /git-upload-pack with missing accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
      });
      expect(res).to.be.false;
    });
  
    it('should return false for /git-upload-pack with wrong accept header', () => {
      const res = validGitRequest('/git-upload-pack', {
        'user-agent': 'git/2.40.0',
        accept: 'application/json',
      });
      expect(res).to.be.false;
    });
  
    it('should return false for unknown paths', () => {
      const res = validGitRequest('/not-a-valid-git-path', {
        'user-agent': 'git/2.40.0',
        accept: 'application/x-git-upload-pack-request',
      });
      expect(res).to.be.false;
    });
  });

  describe('stripGitHubFromGitPath', () => {
    it('should strip owner and repo from a valid GitHub-style path with 4 parts', () => {
      const res = stripGitHubFromGitPath('/foo/bar.git/info/refs');
      expect(res).to.equal('/info/refs');
    });
  
    it('should strip owner and repo from a valid GitHub-style path with 5 parts', () => {
      const res = stripGitHubFromGitPath('/foo/bar.git/git-upload-pack');
      expect(res).to.equal('/git-upload-pack');
    });
  
    it('should return undefined for malformed path with too few segments', () => {
      const res = stripGitHubFromGitPath('/foo/bar.git');
      expect(res).to.be.undefined;
    });
  
    it('should return undefined for malformed path with too many segments', () => {
      const res = stripGitHubFromGitPath('/foo/bar.git/extra/path/stuff');
      expect(res).to.be.undefined;
    });
  
    it('should handle repo names that include dots correctly', () => {
      const res = stripGitHubFromGitPath('/foo/some.repo.git/info/refs');
      expect(res).to.equal('/info/refs');
    });
  
    it('should not break if the path is just a slash', () => {
      const res = stripGitHubFromGitPath('/');
      expect(res).to.be.undefined;
    });
  
    it('should not break if the path is empty', () => {
      const res = stripGitHubFromGitPath('');
      expect(res).to.be.undefined;
    });
  });
});
