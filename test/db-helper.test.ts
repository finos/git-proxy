import { describe, it, expect } from 'vitest';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../src/db/helper';

describe('db helpers', () => {
  describe('trimPrefixRefsHeads', () => {
    it('removes `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/test');
      expect(res).toBe('test');
    });

    it('removes only one `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/refs/heads/');
      expect(res).toBe('refs/heads/');
    });

    it('removes only the first `refs/heads/`', () => {
      const res = trimPrefixRefsHeads('refs/heads/middle/refs/heads/end/refs/heads/');
      expect(res).toBe('middle/refs/heads/end/refs/heads/');
    });

    it('handles empty string', () => {
      const res = trimPrefixRefsHeads('');
      expect(res).toBe('');
    });

    it("doesn't remove `refs/heads`", () => {
      const res = trimPrefixRefsHeads('refs/headstest');
      expect(res).toBe('refs/headstest');
    });

    it("doesn't remove `/refs/heads/`", () => {
      const res = trimPrefixRefsHeads('/refs/heads/test');
      expect(res).toBe('/refs/heads/test');
    });
  });

  describe('trimTrailingDotGit', () => {
    it('removes `.git`', () => {
      const res = trimTrailingDotGit('test.git');
      expect(res).toBe('test');
    });

    it('removes only one `.git`', () => {
      const res = trimTrailingDotGit('.git.git');
      expect(res).toBe('.git');
    });

    it('removes only the last `.git`', () => {
      const res = trimTrailingDotGit('.git-middle.git-end.git');
      expect(res).toBe('.git-middle.git-end');
    });

    it('handles empty string', () => {
      const res = trimTrailingDotGit('');
      expect(res).toBe('');
    });

    it("doesn't remove just `git`", () => {
      const res = trimTrailingDotGit('testgit');
      expect(res).toBe('testgit');
    });
  });
});
