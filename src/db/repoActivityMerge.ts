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

import { canonicalRemoteUrl } from '../activity/canonicalRemoteUrl';
import { Repo, RepoActivityTabCounts, emptyRepoActivityTabCounts } from './types';

export function attachRepoActivityTabCounts(
  repos: Repo[],
  tabCounts: Map<string, RepoActivityTabCounts>,
  latestPendingReviewAtMs: Map<string, number>,
  latestPushAtMs: Map<string, number>,
): Repo[] {
  return repos.map((repo) => {
    const key = canonicalRemoteUrl(repo.url ?? '');
    const activity = key && tabCounts.has(key) ? tabCounts.get(key)! : emptyRepoActivityTabCounts();
    const pendingMs = key ? latestPendingReviewAtMs.get(key) : undefined;
    const pushMs = key ? latestPushAtMs.get(key) : undefined;
    return Object.assign(repo, {
      activity,
      ...(pendingMs !== undefined ? { latestPendingReviewAtMs: pendingMs } : {}),
      ...(pushMs !== undefined ? { latestPushAtMs: pushMs } : {}),
    });
  });
}
