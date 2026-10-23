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

export type ActivityTab = 'all' | 'pending' | 'approved' | 'canceled' | 'rejected' | 'error';

export const DEFAULT_ACTIVITY_TAB: ActivityTab = 'pending';

export const ACTIVITY_TAB_VALUES = [
  'all',
  'pending',
  'approved',
  'canceled',
  'rejected',
  'error',
] as const satisfies readonly ActivityTab[];

export const isActivityTab = (value: string): value is ActivityTab =>
  (ACTIVITY_TAB_VALUES as readonly string[]).includes(value);

export type ActivityListUrlState = {
  tab: ActivityTab;
  filter: string;
  page: number;
  /** Registered repository `_id` when filtering the list to one repo. */
  repo: string | null;
};

export const parseActivityListUrlState = (params: URLSearchParams): ActivityListUrlState => {
  const tabRaw = params.get('tab');
  const tab: ActivityTab =
    tabRaw !== null && tabRaw !== '' && isActivityTab(tabRaw) ? tabRaw : DEFAULT_ACTIVITY_TAB;

  const filter = (params.get('filter') ?? '').trim();

  const repoRaw = params.get('repo');
  const repo = repoRaw !== null && repoRaw.trim() !== '' ? repoRaw.trim() : null;

  const pageRaw = params.get('page');
  let page = 1;
  if (pageRaw !== null && pageRaw !== '') {
    const n = Number.parseInt(pageRaw, 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  return { tab, filter, page, repo };
};

export const applyActivityListUrlPatch = (
  prev: URLSearchParams,
  patch: Partial<Pick<ActivityListUrlState, 'tab' | 'filter' | 'page' | 'repo'>>,
): URLSearchParams => {
  const current = parseActivityListUrlState(prev);
  const merged: ActivityListUrlState = {
    tab: patch.tab ?? current.tab,
    filter: patch.filter !== undefined ? patch.filter.trim() : current.filter,
    page:
      patch.page !== undefined
        ? Number.isFinite(patch.page) && patch.page >= 1
          ? Math.floor(patch.page)
          : 1
        : current.page,
    repo:
      patch.repo !== undefined
        ? patch.repo !== null && patch.repo.trim() !== ''
          ? patch.repo.trim()
          : null
        : current.repo,
  };

  const next = new URLSearchParams(prev);
  next.delete('q');

  if (merged.tab === DEFAULT_ACTIVITY_TAB) {
    next.delete('tab');
  } else {
    next.set('tab', merged.tab);
  }

  if (!merged.filter) {
    next.delete('filter');
  } else {
    next.set('filter', merged.filter);
  }

  if (!merged.repo) {
    next.delete('repo');
  } else {
    next.set('repo', merged.repo);
  }

  if (merged.page <= 1) {
    next.delete('page');
  } else {
    next.set('page', String(merged.page));
  }

  return next;
};
