import * as db from '../../db';

/** Regex used to analyze un-proxied Git URLs */
const GIT_URL_REGEX = /(.+:\/\/)([^/]+)(\/.+\.git)(\/.+)*/;

/** Type representing a breakdown of Git URL (un-proxied)*/
export type GitUrlBreakdown = { protocol: string; host: string; repoPath: string };

/** Function that processes Git URLs to extract the protocol, host, path to the
 * git endpoint and discarding any git path (specific operation) that comes after
 * the .git element.
 *
 * E.g. Processing https://github.com/finos/git-proxy.git/info/refs?service=git-upload-pack
 * would produce:
 * - protocol: https://
 * - host: github.com
 * - repoPath: /finos/git-proxy.git
 *
 * and processing https://someOtherHost.com:8080/repo.git
 * would produce:
 * - protocol: https://
 * - host: someOtherHost.com:8080
 * - repoPath: /repo.git
 *
 * @param {string} url The URL to process
 * @return {GitUrlBreakdown | null} A breakdown of the components of the URL.
 */
export const processGitUrl = (url: string): GitUrlBreakdown | null => {
  const components = url.match(GIT_URL_REGEX);
  if (components && components.length >= 5) {
    return {
      protocol: components[1],
      host: components[2],
      repoPath: components[3],
      // component [4] would be any git path, but isn't needed for repo URLs
    };
  } else {
    console.error(`Failed to parse git URL: ${url}`);
    return null;
  }
};

/** Regex used to analyze url paths for requests to the proxy and split them
 * into the embedded git end point and path for the git operation. */
const PROXIED_URL_PATH_REGEX = /(.+\.git)(\/.*)?/;

/** Type representing a breakdown of paths requested from the proxy server */
export type UrlPathBreakdown = { repoPath: string; gitPath: string };

/** Function that processes URL paths (URL with origin removed) of requests to the proxy
 * to extract the embedded repository path and path for the specific git operation to be
 * proxied.
 *
 * E.g. Processing /finos/git-proxy.git/info/refs?service=git-upload-pack
 * would produce:
 * - repoPath: /finos/git-proxy.git
 * - gitPath: /info/refs?service=git-upload-pack
 *
 * and processing /github.com/finos/git-proxy.git/info/refs?service=git-upload-pack
 * would produce:
 * - repoPath: /github.com/finos/git-proxy.git
 * - gitPath: /info/refs?service=git-upload-pack
 *
 * @param {string} requestPath The URL path to process.
 * @return {GitUrlBreakdown | null} A breakdown of the components of the URL path.
 */
export const processUrlPath = (requestPath: string): UrlPathBreakdown | null => {
  const components = requestPath.match(PROXIED_URL_PATH_REGEX);
  if (components && components.length >= 3) {
    return {
      repoPath: components[1],
      gitPath: components[2] ?? '/',
    };
  } else {
    console.error(`Failed to parse proxy url path: ${requestPath}`);
    return null;
  }
};

/** Regex used to analyze repo URLs (with protocol and origin) to extract the repository name and
 * any path or organisation that proceeds and drop the origin and protocol if present. */
const GIT_URL_NAME_ORG_REGEX = /(.+:\/\/)?([^/]+)\/(?:(.*)\/)?([^/]+\.git)/;

/** Type representing a breakdown Git URL into repository name and organisation (project). */
export type GitNameBreakdown = { project: string | null; repoName: string };

/** Function that processes git URLs embedded in proxy request URLs to extract
 * the repository name and any path or organisation.
 *
 * E.g. Processing https://github.com/finos/git-proxy.git
 * would produce:
 * - project: finos
 * - repoName: git-proxy.git
 *
 * Processing https://someGitHost.com/repo.git
 * would produce:
 * - project: null
 * - repoName: repo.git
 *
 * Processing https://anotherGitHost.com/project/subProject/subSubProject/repo.git
 * would produce:
 * - project: project/subProject/subSubProject
 * - repoName: repo.git
 *
 * @param {string} gitUrl The URL  to process.
 * @return {GitNameBreakdown | null} A breakdown of the components of the URL.
 */
export const processGitURLForNameAndOrg = (gitUrl: string): GitNameBreakdown | null => {
  const components = gitUrl.match(GIT_URL_NAME_ORG_REGEX);
  if (components && components.length >= 5) {
    return {
      project: components[3] ?? null, // there may be no project or path for standalone git repo
      repoName: components[4],
    };
  } else {
    console.error(`Failed to parse git URL: ${gitUrl}`);
    return null;
  }
};

/**
 * Check whether an HTTP request has the expected properties of a
 * Git HTTP request. The URL is expected to be "sanitized", stripped of
 * specific paths such as the GitHub {owner}/{repo}.git parts.
 * @param {string} gitPath Sanitized URL path which only includes the path
 * specific to git (everything after .git/)
 * @param {*} headers Request headers (TODO: Fix JSDoc linting and refer to
 * node:http.IncomingHttpHeaders)
 * @return {boolean} If true, this is a valid and expected git request.
 * Otherwise, false.
 */
export const validGitRequest = (gitPath: string, headers: any): boolean => {
  const { 'user-agent': agent, accept } = headers;
  if (
    ['/info/refs?service=git-upload-pack', '/info/refs?service=git-receive-pack'].includes(gitPath)
  ) {
    // https://www.git-scm.com/docs/http-protocol#_discovering_references
    // We can only filter based on User-Agent since the Accept header is not
    // sent in this request
    return agent.startsWith('git/');
  }
  if (['/git-upload-pack', '/git-receive-pack'].includes(gitPath)) {
    // https://www.git-scm.com/docs/http-protocol#_uploading_data
    return agent.startsWith('git/') && accept.startsWith('application/x-git-');
  }
  return false;
};

/**
 * Collect the Set of all host (host and port if specified) that we
 * will be proxying requests for, to be used to initialize the proxy.
 *
 * @return {string[]} an array of origins
 */
export const getAllProxiedHosts = async (): Promise<string[]> => {
  const repos = await db.getRepos();
  const origins = new Set<string>();
  repos.forEach((repo) => {
    const parsedUrl = processGitUrl(repo.url);
    if (parsedUrl) {
      origins.add(parsedUrl.host);
    } // failures are logged by parsing util fn
  });
  return Array.from(origins);
};
