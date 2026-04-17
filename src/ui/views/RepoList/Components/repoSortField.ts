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

export type RepoSortField =
  | 'relevance'
  | 'lastPushed-asc'
  | 'lastPushed-desc'
  | 'name-asc'
  | 'name-desc'
  | 'activity'
  | 'latestPendingReview';

export type RepoSortAxis = 'relevance' | 'lastPushed' | 'name' | 'activity' | 'latestPendingReview';

export const DEFAULT_REPO_SORT: RepoSortField = 'relevance';

export const REPO_SORT_VALUES = [
  'relevance',
  'lastPushed-asc',
  'lastPushed-desc',
  'name-asc',
  'name-desc',
  'activity',
  'latestPendingReview',
] as const satisfies readonly RepoSortField[];

export const REPO_SORT_AXIS_LABEL = {
  relevance: 'Relevance',
  lastPushed: 'Last pushed',
  name: 'Name',
  activity: 'Activity',
  latestPendingReview: 'Pending',
} as const satisfies Record<RepoSortAxis, string>;

export const isRepoSortField = (value: string): value is RepoSortField =>
  (REPO_SORT_VALUES as readonly string[]).includes(value);

export const repoSortAxis = (sort: RepoSortField): RepoSortAxis => {
  if (sort === 'relevance') return 'relevance';
  if (sort === 'activity') return 'activity';
  if (sort === 'latestPendingReview') return 'latestPendingReview';
  return sort.startsWith('lastPushed') ? 'lastPushed' : 'name';
};

export const repoSortDirection = (sort: RepoSortField): 'asc' | 'desc' => {
  if (sort === 'relevance') return 'desc';
  return sort.endsWith('-asc') ? 'asc' : 'desc';
};

export const repoSortCombine = (axis: RepoSortAxis, dir: 'asc' | 'desc'): RepoSortField => {
  if (axis === 'relevance') return 'relevance';
  if (axis === 'activity') return 'activity';
  if (axis === 'latestPendingReview') return 'latestPendingReview';
  return axis === 'lastPushed' ? `lastPushed-${dir}` : `name-${dir}`;
};

export const repoSortSetAxis = (prev: RepoSortField, axis: RepoSortAxis): RepoSortField => {
  if (axis === 'relevance') return 'relevance';
  if (axis === 'activity') return 'activity';
  if (axis === 'latestPendingReview') return 'latestPendingReview';
  if (prev === 'relevance' || prev === 'activity' || prev === 'latestPendingReview') {
    return repoSortCombine(axis, axis === 'lastPushed' ? 'desc' : 'asc');
  }
  return repoSortCombine(axis, repoSortDirection(prev));
};

export const repoSortSetDirection = (prev: RepoSortField, dir: 'asc' | 'desc'): RepoSortField => {
  const axis = repoSortAxis(prev);
  if (axis === 'relevance') return 'relevance';
  if (axis === 'latestPendingReview') return 'latestPendingReview';
  return repoSortCombine(axis, dir);
};
