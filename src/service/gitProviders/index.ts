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

import { GitHubProvider } from './GitHubProvider';
import { GitLabProvider } from './GitLabProvider';
import type { GitProvider } from './GitProvider';
import { UnsupportedProvider } from './UnsupportedProvider';

export { GitProvider } from './GitProvider';
export type { SCMRepositoryMetadata } from './GitProvider';

export function getGitProvider(remoteUrl: string): GitProvider {
  const hostname = new URL(remoteUrl).hostname.toLowerCase();
  if (hostname === 'github.com') return new GitHubProvider();
  if (hostname.includes('gitlab')) return new GitLabProvider(hostname);
  return new UnsupportedProvider();
}
