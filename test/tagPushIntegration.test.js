const { expect } = require('chai');
const {
  isTagPush,
  getDisplayTimestamp,
  getRefToShow,
  getShaOrTag,
  getCommitterOrTagger,
  getMessage,
  getRepoFullName,
  getGitHubUrl,
} = require('../src/ui/utils/pushUtils');

describe('Tag Push Integration', () => {
  describe('complete tag push workflow', () => {
    const fullTagPush = {
      id: 'tag-push-123',
      repo: 'finos/git-proxy.git',
      branch: 'refs/heads/main',
      tag: 'refs/tags/v2.1.0',
      user: 'release-manager',
      commitFrom: '0000000000000000000000000000000000000000',
      commitTo: 'abcdef1234567890abcdef1234567890abcdef12',
      timestamp: '2024-01-15T10:30:00Z',
      tagData: [
        {
          tagName: 'v2.1.0',
          type: 'annotated',
          tagger: 'release-manager',
          message:
            'Release version 2.1.0\n\nThis release includes:\n- New tag push support\n- Improved UI components\n- Better error handling',
          timestamp: 1705317000, // 2024-01-15 10:30:00
        },
      ],
      commitData: [
        {
          commitTs: 1705316700, // 2024-01-15 10:25:00
          commitTimestamp: 1705316700,
          message: 'feat: implement tag push support',
          committer: 'developer-1',
          author: 'developer-1',
          authorEmail: 'dev1@finos.org',
        },
        {
          commitTs: 1705316400, // 2024-01-15 10:20:00
          commitTimestamp: 1705316400,
          message: 'docs: update README with tag instructions',
          committer: 'developer-2',
          author: 'developer-2',
          authorEmail: 'dev2@finos.org',
        },
      ],
      diff: {
        content: '+++ new tag support implementation',
      },
    };

    it('correctly identifies as tag push', () => {
      expect(isTagPush(fullTagPush)).to.be.true;
    });

    it('generates correct display data for table view', () => {
      const repoName = getRepoFullName(fullTagPush.repo);
      const refToShow = getRefToShow(fullTagPush);
      const shaOrTag = getShaOrTag(fullTagPush);
      const committerOrTagger = getCommitterOrTagger(fullTagPush);
      const message = getMessage(fullTagPush);

      expect(repoName).to.equal('finos/git-proxy');
      expect(refToShow).to.equal('v2.1.0');
      expect(shaOrTag).to.equal('v2.1.0');
      expect(committerOrTagger).to.equal('release-manager');
      expect(message).to.include('Release version 2.1.0');
    });

    it('generates correct GitHub URLs for tag push', () => {
      const repoName = getRepoFullName(fullTagPush.repo);
      const tagName = 'v2.1.0';

      expect(getGitHubUrl.repo(repoName)).to.equal('https://github.com/finos/git-proxy');
      expect(getGitHubUrl.tag(repoName, tagName)).to.equal(
        'https://github.com/finos/git-proxy/releases/tag/v2.1.0',
      );
      expect(getGitHubUrl.user('release-manager')).to.equal('https://github.com/release-manager');
    });

    it('uses tag timestamp over commit timestamp', () => {
      const displayTime = getDisplayTimestamp(
        true,
        fullTagPush.commitData[0],
        fullTagPush.tagData[0],
      );
      expect(displayTime).to.include('2024');
      expect(displayTime).to.include('Jan 15');
    });

    it('handles search functionality properly', () => {
      const searchableFields = {
        repoName: getRepoFullName(fullTagPush.repo).toLowerCase(),
        message: getMessage(fullTagPush).toLowerCase(),
        tagName: fullTagPush.tag.replace('refs/tags/', '').toLowerCase(),
      };

      expect(searchableFields.repoName).to.include('finos');
      expect(searchableFields.message).to.include('release');
      expect(searchableFields.tagName).to.equal('v2.1.0');
    });
  });

  describe('lightweight tag push workflow', () => {
    const lightweightTagPush = {
      id: 'lightweight-tag-123',
      repo: 'example/repo.git',
      tag: 'refs/tags/quick-fix',
      user: 'hotfix-user',
      commitTo: 'fedcba0987654321fedcba0987654321fedcba09',
      tagData: [
        {
          tagName: 'quick-fix',
          type: 'lightweight',
          tagger: 'hotfix-user',
          message: '',
        },
      ],
      commitData: [
        {
          commitTimestamp: 1705317300,
          message: 'fix: critical security patch',
          committer: 'hotfix-user',
          author: 'security-team',
          authorEmail: 'security@example.com',
        },
      ],
    };

    it('handles lightweight tags correctly', () => {
      expect(isTagPush(lightweightTagPush)).to.be.true;
      expect(getRefToShow(lightweightTagPush)).to.equal('quick-fix');
      expect(getShaOrTag(lightweightTagPush)).to.equal('quick-fix');
    });

    it('falls back to commit message for lightweight tags', () => {
      const message = getMessage(lightweightTagPush);
      expect(message).to.equal('fix: critical security patch');
    });
  });

  describe('edge cases in tag push handling', () => {
    it('handles tag push with missing tagData gracefully', () => {
      const incompleteTagPush = {
        id: 'incomplete-tag',
        repo: 'test/repo.git',
        tag: 'refs/tags/broken-tag',
        user: 'test-user',
        commitData: [],
        tagData: [], // Empty tagData
      };

      expect(isTagPush(incompleteTagPush)).to.be.false;
      expect(getCommitterOrTagger(incompleteTagPush)).to.equal('N/A');
    });

    it('handles tag push with malformed tag reference', () => {
      const malformedTagPush = {
        id: 'malformed-tag',
        repo: 'test/repo.git',
        tag: 'malformed-tag-ref', // Missing refs/tags/ prefix
        tagData: [
          {
            tagName: 'v1.0.0',
            type: 'annotated',
            tagger: 'test-user',
            message: 'Test release',
          },
        ],
        commitData: [
          {
            commitTimestamp: 1705317000,
            message: 'test commit',
            committer: 'test-user',
          },
        ],
      };

      expect(isTagPush(malformedTagPush)).to.be.true;
      expect(() => getRefToShow(malformedTagPush)).to.not.throw();
      expect(getRefToShow(malformedTagPush)).to.equal('malformed-tag-ref');
    });

    it('handles complex tag names with special characters', () => {
      const complexTagPush = {
        id: 'complex-tag',
        repo: 'test/repo.git',
        tag: 'refs/tags/v1.0.0-beta.1+build.123',
        tagData: [
          {
            tagName: 'v1.0.0-beta.1+build.123',
            type: 'annotated',
            tagger: 'ci-bot',
            message: 'Pre-release build with metadata',
          },
        ],
        commitData: [
          {
            commitTimestamp: 1705317000,
            message: 'chore: prepare beta release',
            committer: 'ci-bot',
          },
        ],
      };

      expect(isTagPush(complexTagPush)).to.be.true;
      expect(getRefToShow(complexTagPush)).to.equal('v1.0.0-beta.1+build.123');
      expect(getShaOrTag(complexTagPush)).to.equal('v1.0.0-beta.1+build.123');
    });
  });

  describe('comparison with regular commit push', () => {
    const regularCommitPush = {
      id: 'commit-push-456',
      repo: 'finos/git-proxy.git',
      branch: 'refs/heads/feature-branch',
      commitFrom: '1111111111111111111111111111111111111111',
      commitTo: '2222222222222222222222222222222222222222',
      commitData: [
        {
          commitTimestamp: 1705317000,
          message: 'feat: add new feature',
          committer: 'feature-dev',
          author: 'feature-dev',
          authorEmail: 'dev@finos.org',
        },
      ],
    };

    it('differentiates between tag and commit pushes', () => {
      const tagPush = {
        tag: 'refs/tags/v1.0.0',
        tagData: [{ tagName: 'v1.0.0' }],
        commitData: [],
      };

      expect(isTagPush(tagPush)).to.be.true;
      expect(isTagPush(regularCommitPush)).to.be.false;
    });

    it('generates different URLs for tag vs commit pushes', () => {
      const repoName = 'finos/git-proxy';

      // Tag push URLs
      const tagUrl = getGitHubUrl.tag(repoName, 'v1.0.0');
      expect(tagUrl).to.include('/releases/tag/');

      // Commit push URLs
      const commitUrl = getGitHubUrl.commit(repoName, '2222222222222222222222222222222222222222');
      expect(commitUrl).to.include('/commit/');

      const branchUrl = getGitHubUrl.branch(repoName, 'feature-branch');
      expect(branchUrl).to.include('/tree/');
    });

    it('shows different committer/author behavior', () => {
      const tagPushWithUser = {
        tag: 'refs/tags/v1.0.0',
        tagData: [{ tagName: 'v1.0.0' }],
        user: 'tag-creator',
        commitData: [{ committer: 'original-committer' }],
      };

      expect(getCommitterOrTagger(tagPushWithUser)).to.equal('tag-creator');
      expect(getCommitterOrTagger(regularCommitPush)).to.equal('feature-dev');
    });
  });
});
