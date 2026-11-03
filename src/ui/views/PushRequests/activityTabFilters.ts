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

import { activityPrimaryStatusFromFlags } from '../../../activity/activityPrimaryStatus';
import { trimTrailingDotGit } from '../../../db/helper';
import { PushActionView, RepoView } from '../../types';
import { canonicalRemoteUrl } from '../../utils/parseGitRemoteUrl';
import { ACTIVITY_TAB_VALUES, type ActivityTab } from './activityListQuery';

/** Maps canonicalRemoteUrl(repo.url) → same display string as the repositories list. */
export type RepoDisplayIndex = Map<string, string>;

export function buildRepoDisplayIndex(repos: RepoView[]): RepoDisplayIndex {
  const m: RepoDisplayIndex = new Map();
  for (const r of repos) {
    const url = r.url?.trim();
    if (!url) continue;
    const key = canonicalRemoteUrl(url);
    if (!key) continue;
    m.set(key, `${r.project}/${r.name}`);
  }
  return m;
}

/** Label when the push is not matched to a registered repo row. */
export function fallbackActivityRepoLabelFromAction(row: PushActionView): string {
  const proj = row.project?.trim();
  const repoName = row.repoName?.trim();
  if (proj && repoName && proj !== 'UNKNOWN' && repoName !== 'UNKNOWN') {
    return `${proj}/${trimTrailingDotGit(repoName)}`;
  }
  const path = trimTrailingDotGit(row.repo).replace(/^\//u, '');
  return path || row.repo;
}

export function resolveActivityRepoDisplay(row: PushActionView, index: RepoDisplayIndex): string {
  const key = canonicalRemoteUrl(row.url);
  const registered = key ? index.get(key) : undefined;
  return registered ?? fallbackActivityRepoLabelFromAction(row);
}

export function activityMatchesSearch(
  item: PushActionView,
  q: string,
  index: RepoDisplayIndex,
): boolean {
  const lc = (s: string | undefined) => (s ?? '').toLowerCase();
  const listLabel = resolveActivityRepoDisplay(item, index);
  const fields: Array<string | undefined> = [
    item.repo,
    item.project,
    item.repoName,
    item.url,
    item.commitTo,
    item.branch,
    listLabel,
  ];
  for (const c of item.commitData ?? []) {
    fields.push(c.message, c.author, c.authorEmail, c.committer, c.committerEmail);
  }
  return fields.some((f) => lc(f).includes(q));
}

export type ActivityStatusTab = Exclude<ActivityTab, 'all'>;

/**
 * Single status bucket per row so tab counts partition the list (sum of status tabs =
 * {@link ActivityTab} `all` for the same dataset + search).
 * @see activityPrimaryStatusFromFlags
 */
export function activityPrimaryStatusTab(row: PushActionView): ActivityStatusTab {
  return activityPrimaryStatusFromFlags(row);
}

/**
 * `all` matches every row; each other tab matches only rows whose primary status is that tab.
 */
export function matchesActivityTab(row: PushActionView, tab: ActivityTab): boolean {
  if (tab === 'all') {
    return true;
  }
  return activityPrimaryStatusTab(row) === tab;
}

function asPushRows(pushes: unknown): PushActionView[] {
  return Array.isArray(pushes) ? pushes : [];
}

export function filterActivityBySearch(
  pushes: PushActionView[],
  filterRaw: string,
  index: RepoDisplayIndex,
): PushActionView[] {
  const rows = asPushRows(pushes);
  const q = filterRaw.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((item) => activityMatchesSearch(item, q, index));
}

export type ActivityTabCounts = Record<ActivityTab, number>;

export function countActivitiesByTab(searchFiltered: PushActionView[]): ActivityTabCounts {
  const rows = asPushRows(searchFiltered);
  const counts = {} as ActivityTabCounts;
  for (const tab of ACTIVITY_TAB_VALUES) {
    counts[tab] = rows.filter((row) => matchesActivityTab(row, tab)).length;
  }
  return counts;
}

export function filterActivitiesForTab(
  searchFiltered: PushActionView[],
  tab: ActivityTab,
): PushActionView[] {
  return asPushRows(searchFiltered).filter((row) => matchesActivityTab(row, tab));
}
