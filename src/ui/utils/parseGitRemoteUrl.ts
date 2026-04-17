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

export { canonicalRemoteUrl } from '../../activity/canonicalRemoteUrl';

export type ParsedGitRemotePath = {
  /** Path segments before the repo (org or org/group/...). */
  project: string;
  /** Repository name without trailing .git */
  name: string;
};

function segmentsFromPath(path: string): string[] | null {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const repoSegment = parts[parts.length - 1].replace(/\.git$/i, '');
  if (!repoSegment) return null;
  const orgSegments = parts.slice(0, -1);
  const project = orgSegments.join('/');
  if (!project) return null;
  return [project, repoSegment];
}

/**
 * Best-effort parse of a git remote URL/SCP string into project (organization path) and repo name.
 * Does not require `.git` in the last segment (unlike server validation on submit).
 */
export function parseGitRemoteUrl(raw: string): ParsedGitRemotePath | null {
  const input = raw.trim();
  if (!input) return null;

  let pathPart: string | null = null;

  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    pathPart = u.pathname;
  } catch {
    const sshMatch = /^git@[^:]+:(.+)$/i.exec(input);
    if (sshMatch) {
      pathPart = '/' + sshMatch[1].replace(/^\/+/, '');
    } else {
      return null;
    }
  }

  const result = segmentsFromPath(pathPart);
  if (!result) return null;
  const [project, name] = result;
  return { project, name };
}

function isGitHubHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'github.com' || h === 'www.github.com';
}

/** True when the remote URL points at github.com (https or git@github.com). */
export function isGitHubGitRemoteUrl(raw: string): boolean {
  const input = raw.trim();
  if (!input) return false;
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return isGitHubHostname(u.hostname);
  } catch {
    const sshMatch = /^git@([^:]+):/i.exec(input);
    if (!sshMatch) return false;
    return isGitHubHostname(sshMatch[1]);
  }
}
