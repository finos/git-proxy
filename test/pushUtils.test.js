const { expect } = require('chai');
const {
  isTagPush,
  getDisplayTimestamp,
  getTagName,
  getRefToShow,
  getShaOrTag,
  getCommitterOrTagger,
  getAuthor,
  getAuthorEmail,
  getMessage,
  getCommitCount,
  getRepoFullName,
  getGitHubUrl,
  isValidValue,
} = require('../src/ui/utils/pushUtils');

describe('pushUtils', () => {
  const mockCommitData = [
    {
      commitTs: 1640995200, // 2022-01-01 00:00:00
      commitTimestamp: 1640995200,
      message: 'feat: add new feature',
      committer: 'john-doe',
      author: 'jane-smith',
      authorEmail: 'jane@example.com',
    },
  ];

  const mockTagData = [
    {
      tagName: 'v1.0.0',
      type: 'annotated',
      tagger: 'release-bot',
      message: 'Release version 1.0.0',
      timestamp: 1640995300, // 2022-01-01 00:01:40
    },
  ];

  const mockCommitPush = {
    id: 'push-1',
    repo: 'test-repo.git',
    branch: 'refs/heads/main',
    commitTo: '1234567890abcdef',
    commitData: mockCommitData,
  };

  const mockTagPush = {
    id: 'push-2',
    repo: 'test-repo.git',
    branch: 'refs/heads/main',
    tag: 'refs/tags/v1.0.0',
    tagData: mockTagData,
    user: 'release-bot',
    commitTo: '1234567890abcdef',
    commitData: mockCommitData,
  };

  describe('isTagPush', () => {
    it('returns true for tag push with tag data', () => {
      expect(isTagPush(mockTagPush)).to.be.true;
    });

    it('returns false for regular commit push', () => {
      expect(isTagPush(mockCommitPush)).to.be.false;
    });

    it('returns false for tag push without tagData', () => {
      const pushWithoutTagData = { ...mockTagPush, tagData: [] };
      expect(isTagPush(pushWithoutTagData)).to.be.false;
    });

    it('returns false for undefined push data', () => {
      expect(isTagPush(undefined)).to.be.false;
    });
  });

  describe('getDisplayTimestamp', () => {
    it('returns tag timestamp when isTag is true and tagData exists', () => {
      const result = getDisplayTimestamp(true, mockCommitData[0], mockTagData[0]);
      expect(result).to.include('2022');
    });

    it('returns commit timestamp when isTag is false', () => {
      const result = getDisplayTimestamp(false, mockCommitData[0]);
      expect(result).to.include('2022');
    });

    it('returns commit timestamp when isTag is true but no tagData', () => {
      const result = getDisplayTimestamp(true, mockCommitData[0], undefined);
      expect(result).to.include('2022');
    });

    it('returns N/A when no valid timestamps', () => {
      const result = getDisplayTimestamp(false, null);
      expect(result).to.equal('N/A');
    });

    it('prefers commitTimestamp over commitTs', () => {
      const commitWithBothTimestamps = {
        commitTs: 1640995100,
        commitTimestamp: 1640995200,
      };
      const result = getDisplayTimestamp(false, commitWithBothTimestamps);
      expect(result).to.include('2022');
    });
  });

  describe('getTagName', () => {
    it('extracts tag name from refs/tags/ reference', () => {
      expect(getTagName('refs/tags/v1.0.0')).to.equal('v1.0.0');
    });

    it('handles tag name without refs/tags/ prefix', () => {
      expect(getTagName('v1.0.0')).to.equal('v1.0.0');
    });

    it('returns empty string for undefined input', () => {
      expect(getTagName(undefined)).to.equal('');
    });

    it('returns empty string for null input', () => {
      expect(getTagName(null)).to.equal('');
    });

    it('returns empty string for non-string input', () => {
      expect(getTagName(123)).to.equal('');
    });

    it('handles complex tag names', () => {
      expect(getTagName('refs/tags/v1.0.0-beta.1+build.123')).to.equal('v1.0.0-beta.1+build.123');
    });
  });

  describe('getRefToShow', () => {
    it('returns tag name for tag push', () => {
      expect(getRefToShow(mockTagPush)).to.equal('v1.0.0');
    });

    it('returns branch name for commit push', () => {
      expect(getRefToShow(mockCommitPush)).to.equal('main');
    });
  });

  describe('getShaOrTag', () => {
    it('returns tag name for tag push', () => {
      expect(getShaOrTag(mockTagPush)).to.equal('v1.0.0');
    });

    it('returns shortened SHA for commit push', () => {
      expect(getShaOrTag(mockCommitPush)).to.equal('12345678');
    });

    it('handles invalid commitTo gracefully', () => {
      const pushWithInvalidCommit = { ...mockCommitPush, commitTo: null };
      expect(getShaOrTag(pushWithInvalidCommit)).to.equal('N/A');
    });

    it('handles non-string commitTo', () => {
      const pushWithInvalidCommit = { ...mockCommitPush, commitTo: 123 };
      expect(getShaOrTag(pushWithInvalidCommit)).to.equal('N/A');
    });
  });

  describe('getCommitterOrTagger', () => {
    it('returns tagger for tag push', () => {
      expect(getCommitterOrTagger(mockTagPush)).to.equal('release-bot');
    });

    it('returns committer for commit push', () => {
      expect(getCommitterOrTagger(mockCommitPush)).to.equal('john-doe');
    });

    it('returns N/A for empty commitData', () => {
      const pushWithEmptyCommits = { ...mockCommitPush, commitData: [] };
      expect(getCommitterOrTagger(pushWithEmptyCommits)).to.equal('N/A');
    });

    it('returns N/A for invalid commitData', () => {
      const pushWithInvalidCommits = { ...mockCommitPush, commitData: null };
      expect(getCommitterOrTagger(pushWithInvalidCommits)).to.equal('N/A');
    });
  });

  describe('getAuthor', () => {
    it('returns N/A for tag push', () => {
      expect(getAuthor(mockTagPush)).to.equal('N/A');
    });

    it('returns author for commit push', () => {
      expect(getAuthor(mockCommitPush)).to.equal('jane-smith');
    });

    it('returns N/A when author is missing', () => {
      const pushWithoutAuthor = {
        ...mockCommitPush,
        commitData: [{ ...mockCommitData[0], author: undefined }],
      };
      expect(getAuthor(pushWithoutAuthor)).to.equal('N/A');
    });
  });

  describe('getAuthorEmail', () => {
    it('returns N/A for tag push', () => {
      expect(getAuthorEmail(mockTagPush)).to.equal('N/A');
    });

    it('returns author email for commit push', () => {
      expect(getAuthorEmail(mockCommitPush)).to.equal('jane@example.com');
    });

    it('returns N/A when email is missing', () => {
      const pushWithoutEmail = {
        ...mockCommitPush,
        commitData: [{ ...mockCommitData[0], authorEmail: undefined }],
      };
      expect(getAuthorEmail(pushWithoutEmail)).to.equal('N/A');
    });
  });

  describe('getMessage', () => {
    it('returns tag message for tag push', () => {
      expect(getMessage(mockTagPush)).to.equal('Release version 1.0.0');
    });

    it('returns commit message for commit push', () => {
      expect(getMessage(mockCommitPush)).to.equal('feat: add new feature');
    });

    it('falls back to commit message for tag push without tag message', () => {
      const tagPushWithoutMessage = {
        ...mockTagPush,
        tagData: [{ ...mockTagData[0], message: undefined }],
      };
      expect(getMessage(tagPushWithoutMessage)).to.equal('feat: add new feature');
    });

    it('returns empty string for tag push without any message', () => {
      const tagPushWithoutAnyMessage = {
        ...mockTagPush,
        tagData: [{ ...mockTagData[0], message: undefined }],
        commitData: [{ ...mockCommitData[0], message: undefined }],
      };
      expect(getMessage(tagPushWithoutAnyMessage)).to.equal('');
    });
  });

  describe('getCommitCount', () => {
    it('returns commit count', () => {
      expect(getCommitCount(mockCommitPush)).to.equal(1);
    });

    it('returns 0 for empty commitData', () => {
      const pushWithoutCommits = { ...mockCommitPush, commitData: [] };
      expect(getCommitCount(pushWithoutCommits)).to.equal(0);
    });

    it('returns 0 for undefined commitData', () => {
      const pushWithoutCommits = { ...mockCommitPush, commitData: undefined };
      expect(getCommitCount(pushWithoutCommits)).to.equal(0);
    });
  });

  describe('getRepoFullName', () => {
    it('removes .git suffix', () => {
      expect(getRepoFullName('test-repo.git')).to.equal('test-repo');
    });

    it('handles repo without .git suffix', () => {
      expect(getRepoFullName('test-repo')).to.equal('test-repo');
    });
  });

  describe('getGitHubUrl', () => {
    it('generates correct repo URL', () => {
      expect(getGitHubUrl.repo('owner/repo')).to.equal('https://github.com/owner/repo');
    });

    it('generates correct commit URL', () => {
      expect(getGitHubUrl.commit('owner/repo', 'abc123')).to.equal(
        'https://github.com/owner/repo/commit/abc123',
      );
    });

    it('generates correct branch URL', () => {
      expect(getGitHubUrl.branch('owner/repo', 'main')).to.equal(
        'https://github.com/owner/repo/tree/main',
      );
    });

    it('generates correct tag URL', () => {
      expect(getGitHubUrl.tag('owner/repo', 'v1.0.0')).to.equal(
        'https://github.com/owner/repo/releases/tag/v1.0.0',
      );
    });

    it('generates correct user URL', () => {
      expect(getGitHubUrl.user('username')).to.equal('https://github.com/username');
    });
  });

  describe('isValidValue', () => {
    it('returns true for valid string', () => {
      expect(isValidValue('valid')).to.be.true;
    });

    it('returns false for N/A', () => {
      expect(isValidValue('N/A')).to.be.false;
    });

    it('returns false for empty string', () => {
      expect(isValidValue('')).to.be.false;
    });

    it('returns false for undefined', () => {
      expect(isValidValue(undefined)).to.be.false;
    });

    it('returns false for null', () => {
      expect(isValidValue(null)).to.be.false;
    });
  });

  describe('edge cases and error handling', () => {
    it('handles malformed tag reference in getTagName', () => {
      // Should not throw error
      expect(() => getTagName('malformed-ref')).to.not.throw();
      expect(getTagName('malformed-ref')).to.equal('malformed-ref');
    });

    it('handles missing properties gracefully', () => {
      const incompletePush = {
        id: 'incomplete',
        commitData: [],
      };

      expect(() => getCommitterOrTagger(incompletePush)).to.not.throw();
      expect(() => getAuthor(incompletePush)).to.not.throw();
      expect(() => getMessage(incompletePush)).to.not.throw();
      expect(() => getCommitCount(incompletePush)).to.not.throw();
    });

    it('handles non-array commitData', () => {
      const pushWithInvalidCommits = {
        ...mockCommitPush,
        commitData: 'not-an-array',
      };

      expect(getCommitterOrTagger(pushWithInvalidCommits)).to.equal('N/A');
    });
  });
});
