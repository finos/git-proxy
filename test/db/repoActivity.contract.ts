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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Action, RequestType, Step } from '../../src/proxy/actions';
import { canonicalRemoteUrl } from '../../src/activity/canonicalRemoteUrl';
import type { Sink } from '../../src/db/types';

type ActivitySink = Pick<
  Sink,
  | 'writeAudit'
  | 'getPush'
  | 'getPushes'
  | 'getPushesForUserProfile'
  | 'deletePush'
  | 'authorise'
  | 'reject'
  | 'cancel'
  | 'getRepoPushRollupsByCanonicalUrl'
  | 'rebuildRepoPushRollups'
>;
const ids = ['activity-contract-1', 'activity-contract-2', 'activity-contract-3'];
const url = 'https://example.com/activity-contract/repo.git';
const attestation = {
  answers: [{ label: 'Reviewed', checked: true }],
  timestamp: new Date('2026-01-01T00:00:00Z'),
  reviewer: { username: 'Reviewer', email: 'reviewer@example.com' },
};
const rejection = {
  reason: 'Needs changes',
  timestamp: new Date(),
  reviewer: attestation.reviewer,
};
const makePush = (id = ids[0]) => {
  const action = new Action(id, RequestType.PUSH, 'POST', 100, url);
  action.blocked = true;
  return action;
};

export const defineRepoActivityContract = (name: string, sink: ActivitySink): void => {
  describe(name, () => {
    const cleanup = async () => {
      for (const id of ids) await sink.deletePush(id);
    };
    beforeEach(cleanup);
    afterEach(cleanup);

    it.each(['authorise', 'reject', 'cancel'] as const)(
      'preserves detail payloads and list projections after %s and activity rebuilds',
      async (review) => {
        const action = makePush();
        action.userEmail = 'author@example.com';
        action.setDiff('diff --git a/file b/file\n+preserved diff');
        action.addStep(new Step('audit', false, null, false, null, 'preserved step payload'));
        await sink.writeAudit(action);

        const checkPayloads = async () => {
          expect(await sink.getPush(action.id)).toMatchObject({
            diff: action.diff,
            steps: action.steps,
          });
          const lists = [
            await sink.getPushes({}),
            await sink.getPushesForUserProfile([action.userEmail!], 'author'),
          ];
          for (const list of lists) {
            const push = list.find((entry) => entry.id === action.id);
            expect(push).toBeDefined();
            expect(push).not.toHaveProperty('diff');
            expect(push).not.toHaveProperty('steps');
          }
        };

        await checkPayloads();
        if (review === 'authorise') await sink.authorise(action.id, attestation);
        else if (review === 'reject') await sink.reject(action.id, rejection);
        else await sink.cancel(action.id);
        const counts = (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(
          canonicalRemoteUrl(url),
        );
        const status = { authorise: 'approved', reject: 'rejected', cancel: 'canceled' } as const;
        expect(counts?.[status[review]]).toBe(1);
        expect(counts?.pending).toBe(0);
        await checkPayloads();
        await sink.rebuildRepoPushRollups();
        await checkPayloads();
      },
    );

    it('rebuilds activity through the sink API without changing audit records', async () => {
      const action = makePush();
      await sink.writeAudit(action);
      await sink.authorise(action.id, attestation);
      const before = await sink.getPush(action.id);
      const rebuilt = await sink.rebuildRepoPushRollups();
      expect(rebuilt.tabCounts.get(canonicalRemoteUrl(url))?.approved).toBe(1);
      expect(rebuilt.latestPushAtMs.get(canonicalRemoteUrl(url))).toBe(100);
      expect(await sink.getPush(action.id)).toEqual(before);
      expect(await sink.rebuildRepoPushRollups()).toEqual(rebuilt);
    });

    it('keeps activity counts and timestamps correct after updates and deletion', async () => {
      const action = makePush();
      await sink.writeAudit(action);
      const key = canonicalRemoteUrl(url);
      const pending = await sink.getRepoPushRollupsByCanonicalUrl();
      expect(pending.tabCounts.get(key)?.pending).toBe(1);
      expect(pending.latestPendingReviewAtMs.get(key)).toBe(action.timestamp);

      await sink.authorise(action.id, attestation);
      const approved = await sink.getRepoPushRollupsByCanonicalUrl();
      expect(approved.tabCounts.get(key)?.pending).toBe(0);
      expect(approved.tabCounts.get(key)?.approved).toBe(1);
      expect(approved.latestPendingReviewAtMs.has(key)).toBe(false);
      expect(approved.latestPushAtMs.get(key)).toBe(action.timestamp);

      await sink.deletePush(action.id);
      expect((await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.has(key)).toBe(false);
      expect(await sink.getPush(action.id)).toBeNull();
    });

    it('handles retries, concurrent writes, and removal of the latest pending push', async () => {
      const key = canonicalRemoteUrl(url);
      const actions = ids.map((id, index) => {
        const action = makePush(id);
        action.timestamp = 100 + index;
        return action;
      });
      await Promise.all(actions.map((action) => sink.writeAudit(action)));
      await Promise.all(actions.map((action) => sink.writeAudit(action)));
      expect((await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(3);
      await Promise.all([sink.authorise(ids[2], attestation), sink.reject(ids[0], rejection)]);
      const reviewed = await sink.getRepoPushRollupsByCanonicalUrl();
      expect(reviewed.tabCounts.get(key)).toEqual({
        pending: 1,
        approved: 1,
        rejected: 1,
        canceled: 0,
        error: 0,
      });
      expect(reviewed.latestPushAtMs.get(key)).toBe(102);
      expect(reviewed.latestPendingReviewAtMs.get(key)).toBe(101);
      await sink.deletePush(ids[2]);
      await sink.deletePush(ids[2]);
      expect((await sink.getRepoPushRollupsByCanonicalUrl()).latestPushAtMs.get(key)).toBe(101);
    });

    it('moves activity when a stored push changes its canonical repository or request type', async () => {
      const action = makePush();
      await sink.writeAudit(action);
      await sink.getRepoPushRollupsByCanonicalUrl();
      action.url = 'git@EXAMPLE.com:activity-contract/REPO.git';
      await sink.writeAudit(action);
      expect(
        (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(canonicalRemoteUrl(url))
          ?.pending,
      ).toBe(1);
      action.url = 'https://example.com/activity-contract/moved.git';
      await sink.writeAudit(action);
      const moved = await sink.getRepoPushRollupsByCanonicalUrl();
      expect(moved.tabCounts.has(canonicalRemoteUrl(url))).toBe(false);
      expect(moved.tabCounts.get(canonicalRemoteUrl(action.url))?.pending).toBe(1);
      action.type = RequestType.PULL;
      await sink.writeAudit(action);
      expect(
        (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.has(
          canonicalRemoteUrl(action.url),
        ),
      ).toBe(false);
    });

    it('preserves status precedence and counts pushes without valid timestamps', async () => {
      const action = makePush();
      Object.assign(action, { timestamp: undefined });
      action.error = true;
      action.rejected = true;
      action.authorised = true;
      await sink.writeAudit(action);
      const key = canonicalRemoteUrl(url);
      const error = await sink.getRepoPushRollupsByCanonicalUrl();
      expect(error.tabCounts.get(key)).toEqual({
        pending: 0,
        approved: 0,
        rejected: 0,
        canceled: 0,
        error: 1,
      });
      expect(error.latestPushAtMs.has(key)).toBe(false);
      action.error = false;
      action.rejected = false;
      await sink.writeAudit(action);
      await sink.cancel(action.id);
      expect((await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.canceled).toBe(1);
    });
  });
};
