const { expect } = require('chai');
const { trimPrefixRefsHeads, trimTrailingDotGit } = require('../src/db/helper');

describe('db helpers', () => {
  describe('trimPrefixRefsHeads', () => {
    it('removes `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/test');
      expect(res).to.equal('test');
    });

    it('removes only one `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/refs/heads/');
      expect(res).to.equal('refs/heads/');
    });

    it('removes only the first `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/middle/refs/heads/end/refs/heads/');
      expect(res).to.equal('middle/refs/heads/end/refs/heads/');
    });

    it('handles empty string', () => {
      const res = trimPrefixRefsHeads('');
      expect(res).to.equal('');
    });

    it("doesn't remove `refs/heads`", () => {
      const res = trimPrefixRefsHeads('refs/headstest');
      expect(res).to.equal('refs/headstest');
    });

    it("doesn't remove `/refs/heads/`", () => {
      const res = trimPrefixRefsHeads('/refs/heads/test');
      expect(res).to.equal('/refs/heads/test');
    });
  });

  describe('trimTrailingDotGit', () => {
    it('removes `.git`', () => {
      const res = trimTrailingDotGit('test.git');
      expect(res).to.equal('test');
    });

    it('removes only one `.git`', () => {
      const res = trimTrailingDotGit('.git.git');
      expect(res).to.equal('.git');
    });

    it('removes only the last `.git`', () => {
      const res = trimTrailingDotGit('.git-middle.git-end.git');
      expect(res).to.equal('.git-middle.git-end');
    });

    it('handles empty string', () => {
      const res = trimTrailingDotGit('');
      expect(res).to.equal('');
    });

    it("doesn't remove just `git`", () => {
      const res = trimTrailingDotGit('testgit');
      expect(res).to.equal('testgit');
    });
  });
});
