/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect } from 'vitest';
import {
  isTagPush,
  getDisplayTimestamp,
  getRefToShow,
  getShaOrTag,
  getCommitterOrTagger,
  getMessage,
  getRepoFullName,
  getGitHubUrl,
} from '../src/ui/utils/pushUtils';

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
          timestamp: 1705317000,
        },
      ],
      commitData: [
        {
          commitTs: 1705316700,
          commitTimestamp: 1705316700,
          message: 'feat: implement tag push support',
          committer: 'developer-1',
          author: 'developer-1',
          authorEmail: 'dev1@finos.org',
        },
        {
          commitTs: 1705316400,
          commitTimestamp: 1705316400,
          message: 'docs: update README with tag instructions',
          committer: 'developer-2',
          author: 'developer-2',
          authorEmail: 'dev2@finos.org',
        },
      ],
      diff: { content: '+++ new tag support implementation' },
    } as any;

    it('correctly identifies as tag push', () => {
      expect(isTagPush(fullTagPush)).toBe(true);
    });

    it('generates correct display data for table view', () => {
      expect(getRepoFullName(fullTagPush.repo)).toBe('finos/git-proxy');
      expect(getRefToShow(fullTagPush)).toBe('v2.1.0');
      expect(getShaOrTag(fullTagPush)).toBe('v2.1.0');
      expect(getCommitterOrTagger(fullTagPush)).toBe('release-manager');
      expect(getMessage(fullTagPush)).toContain('Release version 2.1.0');
    });

    it('generates correct GitHub URLs for tag push', () => {
      const repoName = getRepoFullName(fullTagPush.repo);
      expect(getGitHubUrl.repo(repoName)).toBe('https://github.com/finos/git-proxy');
      expect(getGitHubUrl.tag(repoName, 'v2.1.0')).toBe(
        'https://github.com/finos/git-proxy/releases/tag/v2.1.0',
      );
      expect(getGitHubUrl.user('release-manager')).toBe('https://github.com/release-manager');
    });

    it('uses tag timestamp over commit timestamp', () => {
      const displayTime = getDisplayTimestamp(
        true,
        fullTagPush.commitData[0],
        fullTagPush.tagData[0],
      );
      expect(displayTime).toContain('2024');
      expect(displayTime).toContain('Jan 15');
    });

    it('handles search functionality properly', () => {
      const searchableFields = {
        repoName: getRepoFullName(fullTagPush.repo).toLowerCase(),
        message: getMessage(fullTagPush).toLowerCase(),
        tagName: fullTagPush.tag.replace('refs/tags/', '').toLowerCase(),
      };
      expect(searchableFields.repoName).toContain('finos');
      expect(searchableFields.message).toContain('release');
      expect(searchableFields.tagName).toBe('v2.1.0');
    });
  });

  describe('lightweight tag push workflow', () => {
    const lightweightTagPush = {
      id: 'lightweight-tag-123',
      repo: 'example/repo.git',
      tag: 'refs/tags/quick-fix',
      user: 'hotfix-user',
      commitTo: 'fedcba0987654321fedcba0987654321fedcba09',
      tagData: [{ tagName: 'quick-fix', type: 'lightweight', tagger: 'hotfix-user', message: '' }],
      commitData: [
        {
          commitTimestamp: 1705317300,
          message: 'fix: critical security patch',
          committer: 'hotfix-user',
          author: 'security-team',
          authorEmail: 'security@example.com',
        },
      ],
    } as any;

    it('handles lightweight tags correctly', () => {
      expect(isTagPush(lightweightTagPush)).toBe(true);
      expect(getRefToShow(lightweightTagPush)).toBe('quick-fix');
      expect(getShaOrTag(lightweightTagPush)).toBe('quick-fix');
    });

    it('falls back to commit message for lightweight tags', () => {
      expect(getMessage(lightweightTagPush)).toBe('fix: critical security patch');
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
        tagData: [],
      } as any;
      expect(isTagPush(incompleteTagPush)).toBe(false);
      expect(getCommitterOrTagger(incompleteTagPush)).toBe('N/A');
    });

    it('handles tag push with malformed tag reference', () => {
      const malformedTagPush = {
        id: 'malformed-tag',
        repo: 'test/repo.git',
        tag: 'malformed-tag-ref',
        tagData: [
          { tagName: 'v1.0.0', type: 'annotated', tagger: 'test-user', message: 'Test release' },
        ],
        commitData: [
          { commitTimestamp: 1705317000, message: 'test commit', committer: 'test-user' },
        ],
      } as any;
      expect(isTagPush(malformedTagPush)).toBe(true);
      expect(() => getRefToShow(malformedTagPush)).not.toThrow();
      expect(getRefToShow(malformedTagPush)).toBe('malformed-tag-ref');
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
            message: 'Pre-release',
          },
        ],
        commitData: [
          {
            commitTimestamp: 1705317000,
            message: 'chore: prepare beta release',
            committer: 'ci-bot',
          },
        ],
      } as any;
      expect(isTagPush(complexTagPush)).toBe(true);
      expect(getRefToShow(complexTagPush)).toBe('v1.0.0-beta.1+build.123');
      expect(getShaOrTag(complexTagPush)).toBe('v1.0.0-beta.1+build.123');
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
    } as any;

    it('differentiates between tag and commit pushes', () => {
      const tagPush = {
        tag: 'refs/tags/v1.0.0',
        tagData: [{ tagName: 'v1.0.0' }],
        commitData: [],
      } as any;
      expect(isTagPush(tagPush)).toBe(true);
      expect(isTagPush(regularCommitPush)).toBe(false);
    });

    it('generates different URLs for tag vs commit pushes', () => {
      const repoName = 'finos/git-proxy';
      expect(getGitHubUrl.tag(repoName, 'v1.0.0')).toContain('/releases/tag/');
      expect(getGitHubUrl.commit(repoName, '2222222222222222222222222222222222222222')).toContain(
        '/commit/',
      );
      expect(getGitHubUrl.branch(repoName, 'feature-branch')).toContain('/tree/');
    });

    it('shows different committer/author behavior', () => {
      const tagPushWithUser = {
        tag: 'refs/tags/v1.0.0',
        tagData: [{ tagName: 'v1.0.0' }],
        user: 'tag-creator',
        commitData: [{ committer: 'original-committer' }],
      } as any;
      expect(getCommitterOrTagger(tagPushWithUser)).toBe('tag-creator');
      expect(getCommitterOrTagger(regularCommitPush)).toBe('feature-dev');
    });
  });
});
