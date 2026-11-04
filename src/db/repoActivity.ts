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

import { isEqual } from 'lodash';
import {
  activityPrimaryStatusFromFlags,
  type ActivityPrimaryStatusInput,
  type ActivityStatusTab,
} from '../activity/activityPrimaryStatus';
import { canonicalRemoteUrl } from '../activity/canonicalRemoteUrl';
import {
  emptyRepoActivityTabCounts,
  type RepoActivityTabCounts,
  type RepoPushRollupsByCanonicalUrl,
} from './types';

export type PushActivityRow = ActivityPrimaryStatusInput & {
  id: string;
  type?: string;
  url?: string;
  timestamp?: number;
};

export type PushActivity = {
  key: string;
  tab: ActivityStatusTab;
  timestamp: number | null;
};

export type RepoActivitySummary = {
  key: string;
  counts: RepoActivityTabCounts;
  latestPush: number | null;
  latestPending: number | null;
};

export const pushActivityProjection = {
  _id: 0,
  id: 1,
  type: 1,
  url: 1,
  timestamp: 1,
  error: 1,
  rejected: 1,
  canceled: 1,
  authorised: 1,
  blocked: 1,
  allowPush: 1,
} as const;

export const pushActivity = (row: PushActivityRow): PushActivity | null => {
  const key = row.type === 'push' && typeof row.url === 'string' ? canonicalRemoteUrl(row.url) : '';
  if (!key) return null;
  return {
    key,
    tab: activityPrimaryStatusFromFlags(row),
    timestamp:
      typeof row.timestamp === 'number' && Number.isFinite(row.timestamp) ? row.timestamp : null,
  };
};

export const emptyRepoSummary = (key: string): RepoActivitySummary => ({
  key,
  counts: emptyRepoActivityTabCounts(),
  latestPush: null,
  latestPending: null,
});

const maxTimestamp = (previous: number | null, next: number | null): number | null =>
  next === null ? previous : previous === null ? next : Math.max(previous, next);

export const addActivity = (summary: RepoActivitySummary, activity: PushActivity): void => {
  summary.counts[activity.tab]++;
  summary.latestPush = maxTimestamp(summary.latestPush, activity.timestamp);
  if (activity.tab === 'pending') {
    summary.latestPending = maxTimestamp(summary.latestPending, activity.timestamp);
  }
};

export const repoRollups = (
  summaries: Iterable<RepoActivitySummary>,
): RepoPushRollupsByCanonicalUrl => {
  const result: RepoPushRollupsByCanonicalUrl = {
    tabCounts: new Map(),
    latestPendingReviewAtMs: new Map(),
    latestPushAtMs: new Map(),
  };
  for (const summary of summaries) {
    if (!Object.values(summary.counts).some((count) => count > 0)) continue;
    result.tabCounts.set(summary.key, { ...summary.counts });
    if (summary.latestPush !== null) result.latestPushAtMs.set(summary.key, summary.latestPush);
    if (summary.latestPending !== null)
      result.latestPendingReviewAtMs.set(summary.key, summary.latestPending);
  }
  return result;
};

export class RepoActivityIndex {
  private readonly pushes = new Map<string, PushActivity>();
  private readonly repositories = new Map<string, Map<string, PushActivity>>();
  private readonly summaries = new Map<string, RepoActivitySummary>();

  set(id: string, activity: PushActivity | null): void {
    const previous = this.pushes.get(id);
    if (isEqual(previous ?? null, activity)) return;
    if (previous) {
      this.pushes.delete(id);
      const rows = this.repositories.get(previous.key);
      const summary = this.summaries.get(previous.key);
      if (rows && summary) {
        rows.delete(id);
        summary.counts[previous.tab]--;
        if (!rows.size) {
          this.repositories.delete(previous.key);
          this.summaries.delete(previous.key);
        } else if (
          previous.timestamp !== null &&
          (previous.timestamp === summary.latestPush ||
            previous.timestamp === summary.latestPending)
        ) {
          summary.latestPush = null;
          summary.latestPending = null;
          for (const row of rows.values()) {
            summary.latestPush = maxTimestamp(summary.latestPush, row.timestamp);
            if (row.tab === 'pending')
              summary.latestPending = maxTimestamp(summary.latestPending, row.timestamp);
          }
        }
      }
    }
    if (activity) {
      this.pushes.set(id, activity);
      let rows = this.repositories.get(activity.key);
      let summary = this.summaries.get(activity.key);
      if (!rows || !summary) {
        rows = new Map();
        summary = emptyRepoSummary(activity.key);
        this.repositories.set(activity.key, rows);
        this.summaries.set(activity.key, summary);
      }
      rows.set(id, activity);
      addActivity(summary, activity);
    }
  }

  snapshot(): RepoPushRollupsByCanonicalUrl {
    return repoRollups(this.summaries.values());
  }
}
