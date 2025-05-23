const { handleMessage, validGitRequest } = require('../src/proxy/routes');
const chai = require('chai');

const expect = chai.expect;

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
});
