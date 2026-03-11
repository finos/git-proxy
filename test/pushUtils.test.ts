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
} from '../src/ui/utils/pushUtils';

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
  } as any;

  const mockTagPush = {
    id: 'push-2',
    repo: 'test-repo.git',
    branch: 'refs/heads/main',
    tag: 'refs/tags/v1.0.0',
    tagData: mockTagData,
    user: 'release-bot',
    commitTo: '1234567890abcdef',
    commitData: mockCommitData,
  } as any;

  describe('isTagPush', () => {
    it('returns true for tag push with tag data', () => {
      expect(isTagPush(mockTagPush)).toBe(true);
    });

    it('returns false for regular commit push', () => {
      expect(isTagPush(mockCommitPush)).toBe(false);
    });

    it('returns false for tag push without tagData', () => {
      const pushWithoutTagData = { ...mockTagPush, tagData: [] };
      expect(isTagPush(pushWithoutTagData)).toBe(false);
    });

    it('returns false for undefined push data', () => {
      expect(isTagPush(undefined as any)).toBe(false);
    });
  });

  describe('getDisplayTimestamp', () => {
    it('returns tag timestamp when isTag is true and tagData exists', () => {
      const result = getDisplayTimestamp(true, mockCommitData[0] as any, mockTagData[0] as any);
      expect(result).toContain('2022');
    });

    it('returns commit timestamp when isTag is false', () => {
      const result = getDisplayTimestamp(false, mockCommitData[0] as any);
      expect(result).toContain('2022');
    });

    it('returns commit timestamp when isTag is true but no tagData', () => {
      const result = getDisplayTimestamp(true, mockCommitData[0] as any, undefined);
      expect(result).toContain('2022');
    });

    it('returns N/A when no valid timestamps', () => {
      const result = getDisplayTimestamp(false, null as any);
      expect(result).toBe('N/A');
    });

    it('prefers commitTimestamp over commitTs', () => {
      const commitWithBothTimestamps = {
        commitTs: 1640995100,
        commitTimestamp: 1640995200,
      };
      const result = getDisplayTimestamp(false, commitWithBothTimestamps as any);
      expect(result).toContain('2022');
    });
  });

  describe('getTagName', () => {
    it('extracts tag name from refs/tags/ reference', () => {
      expect(getTagName('refs/tags/v1.0.0')).toBe('v1.0.0');
    });

    it('handles tag name without refs/tags/ prefix', () => {
      expect(getTagName('v1.0.0')).toBe('v1.0.0');
    });

    it('returns empty string for undefined input', () => {
      expect(getTagName(undefined)).toBe('');
    });

    it('returns empty string for null input', () => {
      expect(getTagName(null as any)).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(getTagName(123 as any)).toBe('');
    });

    it('handles complex tag names', () => {
      expect(getTagName('refs/tags/v1.0.0-beta.1+build.123')).toBe('v1.0.0-beta.1+build.123');
    });
  });

  describe('getRefToShow', () => {
    it('returns tag name for tag push', () => {
      expect(getRefToShow(mockTagPush)).toBe('v1.0.0');
    });

    it('returns branch name for commit push', () => {
      expect(getRefToShow(mockCommitPush)).toBe('main');
    });
  });

  describe('getShaOrTag', () => {
    it('returns tag name for tag push', () => {
      expect(getShaOrTag(mockTagPush)).toBe('v1.0.0');
    });

    it('returns shortened SHA for commit push', () => {
      expect(getShaOrTag(mockCommitPush)).toBe('12345678');
    });

    it('handles invalid commitTo gracefully', () => {
      const pushWithInvalidCommit = { ...mockCommitPush, commitTo: null };
      expect(getShaOrTag(pushWithInvalidCommit)).toBe('N/A');
    });

    it('handles non-string commitTo', () => {
      const pushWithInvalidCommit = { ...mockCommitPush, commitTo: 123 };
      expect(getShaOrTag(pushWithInvalidCommit)).toBe('N/A');
    });
  });

  describe('getCommitterOrTagger', () => {
    it('returns tagger for tag push', () => {
      expect(getCommitterOrTagger(mockTagPush)).toBe('release-bot');
    });

    it('returns committer for commit push', () => {
      expect(getCommitterOrTagger(mockCommitPush)).toBe('john-doe');
    });

    it('returns N/A for empty commitData', () => {
      const pushWithEmptyCommits = { ...mockCommitPush, commitData: [] };
      expect(getCommitterOrTagger(pushWithEmptyCommits)).toBe('N/A');
    });

    it('returns N/A for invalid commitData', () => {
      const pushWithInvalidCommits = { ...mockCommitPush, commitData: null };
      expect(getCommitterOrTagger(pushWithInvalidCommits)).toBe('N/A');
    });
  });

  describe('getAuthor', () => {
    it('returns tagger for tag push', () => {
      expect(getAuthor(mockTagPush)).toBe('release-bot');
    });

    it('returns author for commit push', () => {
      expect(getAuthor(mockCommitPush)).toBe('jane-smith');
    });

    it('returns N/A when author is missing', () => {
      const pushWithoutAuthor = {
        ...mockCommitPush,
        commitData: [{ ...mockCommitData[0], author: undefined }],
      };
      expect(getAuthor(pushWithoutAuthor)).toBe('N/A');
    });
  });

  describe('getAuthorEmail', () => {
    it('returns N/A for tag push', () => {
      expect(getAuthorEmail(mockTagPush)).toBe('N/A');
    });

    it('returns author email for commit push', () => {
      expect(getAuthorEmail(mockCommitPush)).toBe('jane@example.com');
    });

    it('returns N/A when email is missing', () => {
      const pushWithoutEmail = {
        ...mockCommitPush,
        commitData: [{ ...mockCommitData[0], authorEmail: undefined }],
      };
      expect(getAuthorEmail(pushWithoutEmail)).toBe('N/A');
    });
  });

  describe('getMessage', () => {
    it('returns tag message for tag push', () => {
      expect(getMessage(mockTagPush)).toBe('Release version 1.0.0');
    });

    it('returns commit message for commit push', () => {
      expect(getMessage(mockCommitPush)).toBe('feat: add new feature');
    });

    it('falls back to commit message for tag push without tag message', () => {
      const tagPushWithoutMessage = {
        ...mockTagPush,
        tagData: [{ ...mockTagData[0], message: undefined }],
      };
      expect(getMessage(tagPushWithoutMessage)).toBe('feat: add new feature');
    });

    it('returns empty string for tag push without any message', () => {
      const tagPushWithoutAnyMessage = {
        ...mockTagPush,
        tagData: [{ ...mockTagData[0], message: undefined }],
        commitData: [{ ...mockCommitData[0], message: undefined }],
      };
      expect(getMessage(tagPushWithoutAnyMessage)).toBe('');
    });
  });

  describe('getCommitCount', () => {
    it('returns commit count', () => {
      expect(getCommitCount(mockCommitPush)).toBe(1);
    });

    it('returns 0 for empty commitData', () => {
      const pushWithoutCommits = { ...mockCommitPush, commitData: [] };
      expect(getCommitCount(pushWithoutCommits)).toBe(0);
    });

    it('returns 0 for undefined commitData', () => {
      const pushWithoutCommits = { ...mockCommitPush, commitData: undefined };
      expect(getCommitCount(pushWithoutCommits)).toBe(0);
    });
  });

  describe('getRepoFullName', () => {
    it('removes .git suffix', () => {
      expect(getRepoFullName('test-repo.git')).toBe('test-repo');
    });

    it('handles repo without .git suffix', () => {
      expect(getRepoFullName('test-repo')).toBe('test-repo');
    });
  });

  describe('getGitHubUrl', () => {
    it('generates correct repo URL', () => {
      expect(getGitHubUrl.repo('owner/repo')).toBe('https://github.com/owner/repo');
    });

    it('generates correct commit URL', () => {
      expect(getGitHubUrl.commit('owner/repo', 'abc123')).toBe(
        'https://github.com/owner/repo/commit/abc123',
      );
    });

    it('generates correct branch URL', () => {
      expect(getGitHubUrl.branch('owner/repo', 'main')).toBe(
        'https://github.com/owner/repo/tree/main',
      );
    });

    it('generates correct tag URL', () => {
      expect(getGitHubUrl.tag('owner/repo', 'v1.0.0')).toBe(
        'https://github.com/owner/repo/releases/tag/v1.0.0',
      );
    });

    it('generates correct user URL', () => {
      expect(getGitHubUrl.user('username')).toBe('https://github.com/username');
    });
  });

  describe('isValidValue', () => {
    it('returns true for valid string', () => {
      expect(isValidValue('valid')).toBe(true);
    });

    it('returns false for N/A', () => {
      expect(isValidValue('N/A')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidValue('')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidValue(undefined as any)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isValidValue(null as any)).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles malformed tag reference in getTagName', () => {
      expect(() => getTagName('malformed-ref')).not.toThrow();
      expect(getTagName('malformed-ref')).toBe('malformed-ref');
    });

    it('handles missing properties gracefully', () => {
      const incompletePush = {
        id: 'incomplete',
        commitData: [],
      } as any;

      expect(() => getCommitterOrTagger(incompletePush)).not.toThrow();
      expect(() => getAuthor(incompletePush)).not.toThrow();
      expect(() => getMessage(incompletePush)).not.toThrow();
      expect(() => getCommitCount(incompletePush)).not.toThrow();
    });

    it('handles non-array commitData', () => {
      const pushWithInvalidCommits = {
        ...mockCommitPush,
        commitData: 'not-an-array',
      };

      expect(getCommitterOrTagger(pushWithInvalidCommits)).toBe('N/A');
    });
  });
});
