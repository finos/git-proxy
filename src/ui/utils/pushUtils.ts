import moment from 'moment';
import { CommitData, PushData, TagData } from '../../types/models';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../../db/helper';

/**
 * Determines if a push is a tag push
 * @param {PushData} pushData - The push data to check
 * @return {boolean} True if this is a tag push, false otherwise
 */
export const isTagPush = (pushData: PushData): boolean => {
  return Boolean(pushData?.tag && pushData?.tagData && pushData.tagData.length > 0);
};

/**
 * Gets the display timestamp for a push (handles both commits and tags)
 * @param {boolean} isTag - Whether this is a tag push
 * @param {CommitData | null} commitData - The commit data
 * @param {TagData} [tagData] - The tag data (optional)
 * @return {string} Formatted timestamp string or 'N/A'
 */
export const getDisplayTimestamp = (
  isTag: boolean,
  commitData: CommitData | null,
  tagData?: TagData,
): string => {
  // For tag pushes, try to use tag timestamp if available
  if (isTag && tagData?.timestamp) {
    return moment.unix(parseInt(tagData.timestamp)).toString();
  }

  // Fallback to commit timestamp for both commits and tags without timestamp
  if (commitData) {
    const timestamp = commitData.commitTimestamp || commitData.commitTs;
    return timestamp ? moment.unix(timestamp).toString() : 'N/A';
  }

  return 'N/A';
};

/**
 * Safely extracts tag name from git reference
 * @param {string} [tagRef] - The git tag reference (e.g., 'refs/tags/v1.0.0')
 * @return {string} The tag name without the 'refs/tags/' prefix
 */
export const getTagName = (tagRef?: string): string => {
  if (!tagRef || typeof tagRef !== 'string') return '';
  try {
    return tagRef.replace('refs/tags/', '');
  } catch (error) {
    console.warn('Error parsing tag reference:', tagRef, error);
    return '';
  }
};

/**
 * Gets the appropriate reference to show (tag name or branch name)
 * @param {PushData} pushData - The push data
 * @return {string} The reference name to display
 */
export const getRefToShow = (pushData: PushData): string => {
  if (isTagPush(pushData)) {
    return getTagName(pushData.tag);
  }
  return trimPrefixRefsHeads(pushData.branch);
};

/**
 * Gets the SHA or tag identifier for display
 * @param {PushData} pushData - The push data
 * @return {string} The SHA (shortened) or tag name
 */
export const getShaOrTag = (pushData: PushData): string => {
  if (isTagPush(pushData)) {
    return getTagName(pushData.tag);
  }

  if (!pushData.commitTo || typeof pushData.commitTo !== 'string') {
    console.warn('Invalid commitTo value:', pushData.commitTo);
    return 'N/A';
  }

  return pushData.commitTo.substring(0, 8);
};

/**
 * Gets the committer or tagger based on push type
 * @param {PushData} pushData - The push data
 * @return {string} The committer username for commits or tagger for tags
 */
export const getCommitterOrTagger = (pushData: PushData): string => {
  if (isTagPush(pushData) && pushData.user) {
    return pushData.user;
  }

  if (
    !pushData.commitData ||
    !Array.isArray(pushData.commitData) ||
    pushData.commitData.length === 0
  ) {
    console.warn('Invalid or empty commitData:', pushData.commitData);
    return 'N/A';
  }

  return pushData.commitData[0]?.committer || 'N/A';
};

/**
 * Gets the author (tagger for tag pushes)
 * @param {PushData} pushData - The push data
 * @return {string} The author username for commits or tagger for tags
 */
export const getAuthor = (pushData: PushData): string => {
  if (isTagPush(pushData)) {
    return pushData.tagData?.[0]?.tagger || 'N/A';
  }
  return pushData.commitData[0]?.author || 'N/A';
};

/**
 * Gets the author email (tagger email for tag pushes)
 * @param {PushData} pushData - The push data
 * @return {string} The author email for commits or tagger email for tags
 */
export const getAuthorEmail = (pushData: PushData): string => {
  if (isTagPush(pushData)) {
    return pushData.tagData?.[0]?.taggerEmail || 'N/A';
  }
  return pushData.commitData[0]?.authorEmail || 'N/A';
};

/**
 * Gets the message (tag message or commit message)
 * @param {PushData} pushData - The push data
 * @return {string} The appropriate message for the push type
 */
export const getMessage = (pushData: PushData): string => {
  if (isTagPush(pushData)) {
    // For tags, try tag message first, then fallback to commit message
    return pushData.tagData?.[0]?.message || pushData.commitData[0]?.message || '';
  }
  return pushData.commitData[0]?.message || 'N/A';
};

/**
 * Gets the commit count
 * @param {PushData} pushData - The push data
 * @return {number} The number of commits in the push
 */
export const getCommitCount = (pushData: PushData): number => {
  return pushData.commitData?.length || 0;
};

/**
 * Gets the cleaned repository name
 * @param {string} repo - The repository name (may include .git suffix)
 * @return {string} The cleaned repository name without .git suffix
 */
export const getRepoFullName = (repo: string): string => {
  return trimTrailingDotGit(repo);
};

/**
 * Generates GitHub URLs for different reference types
 */
export const getGitHubUrl = {
  repo: (repoName: string) => `https://github.com/${repoName}`,
  commit: (repoName: string, sha: string) => `https://github.com/${repoName}/commit/${sha}`,
  branch: (repoName: string, branch: string) => `https://github.com/${repoName}/tree/${branch}`,
  tag: (repoName: string, tagName: string) =>
    `https://github.com/${repoName}/releases/tag/${tagName}`,
  user: (username: string) => `https://github.com/${username}`,
};

/**
 * Checks if a value is not "N/A" and not empty
 * @param {string | undefined} value - The value to check
 * @return {boolean} True if the value is valid (not N/A and not empty)
 */
export const isValidValue = (value: string | undefined): value is string => {
  return Boolean(value && value !== 'N/A');
};
