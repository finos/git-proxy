import axios from 'axios';
import React from 'react';
import { GitHubRepositoryMetadata, GitLabRepositoryMetadata, SCMRepositoryMetadata } from './types';
import { CommitData } from '../proxy/processors/types';
import moment from 'moment';
import { getErrorMessage } from '../utils/errors';

/**
 * Retrieve a decoded cookie value from `document.cookie` with given `name`.
 * @param {string} name - The name of the cookie to retrieve
 * @return {string | null} - The cookie value or null if not found
 */
export const getCookie = (name: string): string | null => {
  if (!document.cookie) return null;

  const cookies = document.cookie
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(name + '='));

  if (!cookies.length) return null;

  return decodeURIComponent(cookies[0].split('=')[1]);
};

/**
 * Retrieve a string indicating whether a repository URL is hosted
 * by a known SCM provider (github or gitlab).
 * @param {string} url The repository URL.
 * @return {string} A string representing the SCM provider or 'unknown'.
 */
export const getGitProvider = (url: string) => {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === 'github.com') return 'github';
  if (hostname.includes('gitlab')) return 'gitlab';
  return 'unknown';
};

/**
 * Renders a block of mailto: links for author user names and email addresses found in an array of commit data.
 *
 * @param {CommitData[]} commitData The user.name to render in the link.
 * @return {JSX.Element} A JSX Element representing the rendered links
 */
export const generateAuthorLinks = (commitData: CommitData[]) => {
  const orderedAuthors: JSX.Element[] = [];
  const uniqueAuthors: Set<string> = new Set();
  commitData.forEach((row) => {
    if (!uniqueAuthors.has(row.authorEmail)) {
      uniqueAuthors.add(row.authorEmail);
      orderedAuthors.push(
        <div>
          <a href={`mailto:${row.authorEmail}`}>
            &quot;{row.author}&quot; &lt;{row.authorEmail}&gt;
          </a>
        </div>,
      );
    }
  });
  return <div>{orderedAuthors}</div>;
};

/**
 * Renders a mailto: link for user name and email address, for use in rendering details of pushes.
 *
 * @param {string} name The user.name to render in the link.
 * @param {string} email The email address to render in the link.
 * @return {JSX.Element} An <a> tag based on the username and email address.
 */
export const generateEmailLink = (name: string, email: string) => {
  return email ? (
    <a href={`mailto:${email}`}>
      &quot;{name}&quot; &lt;{email}&gt;
    </a>
  ) : (
    <strong>No data...</strong>
  );
};

/**
 * Predicts a user's profile URL based on their username and the SCM provider's details.
 * TODO: update this to attempt to resolve a user email to a profile URL
 *
 * @param {string} username The username.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string | null} The predicted profile URL or null
 */
export const getUserProfileUrl = (username: string, provider: string, hostname: string) => {
  if (provider == 'github') {
    return `https://github.com/${username}`;
  } else if (provider == 'gitlab') {
    return `https://${hostname}/${username}`;
  } else {
    return null;
  }
};

/**
 * Attempts to construct a link to the user's profile at an SCM provider.
 *
 * TODO: update this to attempt to resolve a user email to a profile URL
 *
 * @param {string} username The username.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string} A string containing an HTML A tag pointing to the user's profile, if possible, degrading to just the username or 'N/A' when not (e.g. because the SCM provider is unknown).
 */
export const getUserProfileLink = (username: string, provider: string, hostname: string) => {
  if (username) {
    let profileData = '';
    const profileUrl = getUserProfileUrl(username, provider, hostname);
    if (profileUrl) {
      profileData = `<a href="${profileUrl}" rel='noreferrer' target='_blank'>${username}</a>`;
    } else {
      profileData = `<span>${username}</span>`;
    }
    return profileData;
  } else {
    return 'N/A';
  }
};

/**
 * Predicts an organisation's profile URL at an SCM provider.
 * @param {string} project The organisation name.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string} The predicted profile URL or null.
 */
export const getOrganisationProfileUrl = (project: string, provider: string, hostname: string) => {
  if (provider == 'github') {
    return `https://github.com/${project}`;
  } else if (provider == 'gitlab') {
    return `https://${hostname}/${project}`;
  } else {
    return null;
  }
};

/**
 * Predicts an organisation's profile image URL at an SCM provider.
 * @param {string} project The organisation name.
 * @param {string} provider The name of the SCM provider.
 * @param {string} hostname The hostname of the SCM provider.
 * @return {string} The predicted profile URL or null.
 */
export const getOrganisationProfileImageUrl = (
  project: string,
  provider: string,
  hostname: string,
) => {
  if (provider == 'github') {
    return `https://github.com/${project}.png`;
  } else if (provider == 'gitlab') {
    return `https://${hostname}/${project}.png`;
  } else {
    return null;
  }
};

/**
 * Retrieves data about repositories hosted at known SCM providers.
 * @param {string} project The organisations's name.
 * @param {string} name The repository name.
 * @param {string} url The URL of the repository (used to detect the SCM provider)
 * @return {Promise<SCMRepositoryMetadata | null>} Data retrieved from teh SCM provider or null
 */
export const fetchRemoteRepositoryData = async (
  project: string,
  name: string,
  url: string,
): Promise<SCMRepositoryMetadata | null> => {
  const provider = getGitProvider(url);
  const hostname = new URL(url).hostname;

  if (provider === 'github') {
    const response = await axios.get<GitHubRepositoryMetadata>(
      `https://api.github.com/repos/${project}/${name}`,
    );

    return {
      description: response.data.description,
      language: response.data.language,
      license: response.data.license?.spdx_id,
      lastUpdated: moment
        .max([
          moment(response.data.created_at),
          moment(response.data.updated_at),
          moment(response.data.pushed_at),
        ])
        .fromNow(),
      htmlUrl: response.data.html_url,
      parentName: response.data.parent?.full_name,
      parentUrl: response.data.parent?.html_url,

      avatarUrl: response.data.owner?.avatar_url,
      profileUrl: response.data.owner?.html_url,
    };
  } else if (provider == 'gitlab') {
    const projectPath = encodeURIComponent(`${project}/${name}`);
    const apiUrl = `https://${hostname}/api/v4/projects/${projectPath}`;
    const response = await axios.get<GitLabRepositoryMetadata>(apiUrl);

    // Make follow-up call to get languages
    let primaryLanguage;
    try {
      const languagesResponse = await axios.get(
        `https://${hostname}/api/v4/projects/${projectPath}/languages`,
      );
      const languages = languagesResponse.data;
      // Get the first key (primary language) from the ordered hash
      primaryLanguage = Object.keys(languages)[0];
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      console.warn('Could not fetch language data:', msg);
    }

    return {
      description: response.data.description,
      language: primaryLanguage,
      license: response.data.license?.nickname,
      lastUpdated: moment(response.data.last_activity_at).fromNow(),
      htmlUrl: response.data.web_url,
      parentName: response.data.forked_from_project?.full_name,
      parentUrl: response.data.forked_from_project?.web_url,
      avatarUrl: response.data.avatar_url,
      profileUrl: response.data.namespace?.web_url,
    };
  } else {
    // For other/unknown providers, don't make API calls
    return null;
  }
};
