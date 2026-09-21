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

/** Strip ".git", slashes, used to compare push remote URLs to registered repo.url. */
function normalizeRepoPathForMatch(path: string): string {
  let p = path.replace(/^\/+|\/+$/gu, '');
  if (p.toLowerCase().endsWith('.git')) {
    p = p.slice(0, -4);
  }
  return p;
}

/**
 * Stable key for matching a git remote (HTTPS or git@host:path) to a row in the repo catalog.
 * Host is lowercased; path is lowercased for case-insensitive hosts (GitHub, typical GitLab).
 */
export function canonicalRemoteUrl(raw: string): string {
  const input = raw.trim();
  if (!input) {
    return '';
  }
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return input.toLowerCase();
    }
    const host = u.hostname.toLowerCase();
    const port = u.port ? `:${u.port}` : '';
    const path = normalizeRepoPathForMatch(u.pathname);
    return `${host}${port}/${path}`.toLowerCase();
  } catch {
    const m = /^git@([^:]+):(.+)$/iu.exec(input);
    if (m) {
      const host = m[1].toLowerCase();
      const path = normalizeRepoPathForMatch(m[2]);
      return `${host}/${path}`.toLowerCase();
    }
    return input.toLowerCase();
  }
}
