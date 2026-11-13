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

import { describe, expect, it } from 'vitest';
import { RepoActivityIndex, pushActivity, type PushActivity } from '../../src/db/repoActivity';

describe('repository activity index', () => {
  it('updates counts once, falls back to older timestamps, and removes empty repositories', () => {
    const index = new RepoActivityIndex();
    const old: PushActivity = { key: 'example.com/a/b', tab: 'pending', timestamp: 10 };
    index.set('old', old);
    index.set('new', { ...old, timestamp: 20 });
    index.set('old', old);
    expect(index.snapshot().tabCounts.get(old.key)?.pending).toBe(2);
    index.set('new', { ...old, tab: 'approved', timestamp: 20 });
    expect(index.snapshot().latestPendingReviewAtMs.get(old.key)).toBe(10);
    expect(index.snapshot().latestPushAtMs.get(old.key)).toBe(20);
    index.set('new', null);
    expect(index.snapshot().latestPushAtMs.get(old.key)).toBe(10);
    index.set('old', null);
    expect(index.snapshot().tabCounts.size).toBe(0);
    expect(index.snapshot().latestPushAtMs.size).toBe(0);
  });

  it('moves contributions between repositories and isolates returned snapshots', () => {
    const index = new RepoActivityIndex();
    index.set('push', { key: 'old', tab: 'pending', timestamp: 0 });
    const first = index.snapshot();
    const counts = first.tabCounts.get('old');
    if (counts) counts.pending = 42;
    expect(index.snapshot().tabCounts.get('old')?.pending).toBe(1);
    index.set('push', { key: 'new', tab: 'error', timestamp: -1 });
    expect(index.snapshot().tabCounts.has('old')).toBe(false);
    expect(index.snapshot().tabCounts.get('new')?.error).toBe(1);
    expect(index.snapshot().latestPushAtMs.get('new')).toBe(-1);
  });

  it('uses the Activity status precedence and canonical remote identity', () => {
    expect(
      pushActivity({
        id: 'push',
        type: 'push',
        url: 'git@Example.com:ORG/REPO.git',
        error: true,
        rejected: true,
        canceled: true,
        authorised: true,
        blocked: true,
        timestamp: 10,
      }),
    ).toEqual({ key: 'example.com/org/repo', tab: 'error', timestamp: 10 });
    expect(pushActivity({ id: 'pull', type: 'pull', url: 'https://example.com/a/b' })).toBeNull();
    expect(pushActivity({ id: 'empty', type: 'push', url: '  ' })).toBeNull();
  });

  it.each([undefined, NaN, Infinity, -Infinity])(
    'counts pushes without using invalid timestamp %s',
    (timestamp) => {
      const activity = pushActivity({
        id: 'push',
        type: 'push',
        url: 'https://example.com/a/b',
        timestamp,
      });
      const index = new RepoActivityIndex();
      index.set('push', activity);
      expect(index.snapshot().tabCounts.get('example.com/a/b')?.pending).toBe(1);
      expect(index.snapshot().latestPushAtMs.size).toBe(0);
    },
  );
});
