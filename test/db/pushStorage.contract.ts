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
import { Action, PushType, RequestType, Step } from '../../src/proxy/actions';
import { canonicalRemoteUrl } from '../../src/activity/canonicalRemoteUrl';
import type { Sink } from '../../src/db/types';

type PushStorage = Pick<
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
>;

const ids = ['storage-contract-1', 'storage-contract-2', 'storage-contract-3'];
const url = 'https://example.com/storage-contract/repo.git';
const diff = 'diff --git a/private.txt b/private.txt\n+private payload\n';
const attestation = {
  answers: [{ label: 'Reviewed', checked: true }],
  timestamp: new Date('2026-01-01T00:00:00Z'),
  reviewer: { username: 'Reviewer', email: 'reviewer@example.com' },
};
const rejection = {
  reason: 'Needs changes',
  timestamp: new Date('2026-01-02T00:00:00Z'),
  reviewer: attestation.reviewer,
};

const makePush = (id = ids[0], content = diff): Action => {
  const action = new Action(id, RequestType.PUSH, 'POST', 100, url);
  action.blocked = true;
  action.user = 'Contributor';
  action.userEmail = 'author@example.com';
  action.branch = 'refs/heads/main';
  action.commitFrom = 'a'.repeat(40);
  action.commitTo = 'b'.repeat(40);
  const step = new Step('diff', false, null, false, null, content);
  // Historical pushes include the raw diff in logs and sometimes in lastStep too.
  step.logs = [`diff - ${content}`];
  action.addStep(step);
  return action;
};

/** Exercise real sinks with one shared contract; mocks cannot validate database projections. */
export const definePushStorageContract = (
  name: string,
  sink: PushStorage,
  readStored: (id: string) => Promise<unknown>,
): void => {
  describe(name, () => {
    const cleanup = async () => {
      for (const id of ids) await sink.deletePush(id);
    };
    beforeEach(cleanup);
    afterEach(cleanup);

    it('stores a diff in the final step once without changing the detail response', async () => {
      const action = makePush();
      action.steps[0].logs = ['diff - Generated diff'];
      await sink.writeAudit(action);
      const stored = await readStored(action.id);
      expect(stored).not.toHaveProperty('lastStep');
      expect(JSON.stringify(stored).match(/private payload/g)).toHaveLength(1);
      const detail = await sink.getPush(action.id);
      expect(detail?.lastStep).toEqual(action.lastStep);
      expect(detail).not.toHaveProperty('_lastStepIndex');

      action.lastStep = new Step('failedAfterDiff');
      action.lastStep.setError('Preserve a separate diagnostic');
      await sink.writeAudit(action);
      expect(await readStored(action.id)).not.toHaveProperty('_lastStepIndex');
      expect((await sink.getPush(action.id))?.lastStep).toEqual(action.lastStep);
    });

    it('keeps legacy audit content on detail reads while excluding every diff copy from lists', async () => {
      const action = makePush();
      // Future top-level diff records from #1693 must also remain outside list responses.
      Object.assign(action, { diff, pluginPrivateData: diff });
      await sink.writeAudit(action);

      const summaries = await sink.getPushes({ type: 'push' });
      const summary = summaries.find((push) => push.id === action.id)!;
      expect(summary).toMatchObject({
        id: action.id,
        url,
        user: 'Contributor',
        userEmail: 'author@example.com',
        commitFrom: action.commitFrom,
        commitTo: action.commitTo,
        blocked: true,
      });
      for (const field of ['steps', 'lastStep', 'diff', '_id', 'pluginPrivateData']) {
        expect(summary).not.toHaveProperty(field);
      }
      expect(JSON.stringify(summary)).not.toContain('private payload');

      const detail = await sink.getPush(action.id);
      expect(detail?.steps[0].content).toBe(diff);
      expect(detail?.steps[0].logs).toEqual([`diff - ${diff}`]);
      expect(detail?.lastStep?.content).toBe(diff);
    });

    it('returns equally small summaries for small and multi-megabyte diffs', async () => {
      await sink.writeAudit(makePush(ids[0], 'small diff'));
      await sink.writeAudit(makePush(ids[1], 'private payload\n'.repeat(131072)));

      const summaries = (await sink.getPushes({ type: 'push' })).filter((push) =>
        ids.includes(push.id),
      );
      expect(summaries).toHaveLength(2);
      const sizes = summaries.map((push) => Buffer.byteLength(JSON.stringify(push)));
      expect(sizes[0]).toBe(sizes[1]);
      expect(sizes[0]).toBeLessThan(2000);
      expect((await sink.getPush(ids[1]))?.steps[0].content.length).toBeGreaterThan(2_000_000);
    });

    it('preserves tag metadata used by the activity table', async () => {
      const action = makePush();
      action.actionType = PushType.TAG;
      action.tags = ['refs/tags/v1'];
      action.tagData = [
        {
          type: 'tag',
          tagName: 'v1',
          tagger: 'Tagger',
          taggerEmail: 'tagger@example.com',
          message: 'Release',
        },
      ];
      action.steps = [];
      delete action.lastStep;
      await sink.writeAudit(action);

      expect(
        (await sink.getPushes({ type: 'push' })).find((push) => push.id === action.id),
      ).toMatchObject({ actionType: PushType.TAG, tags: action.tags, tagData: action.tagData });
      expect((await sink.getPush(action.id))?.steps).toEqual([]);
    });

    it('preserves filtering and newest-first ordering', async () => {
      for (let i = 0; i < ids.length; i++) {
        const action = makePush(ids[i]);
        action.timestamp = 100 + i;
        action.authorised = i === 1;
        await sink.writeAudit(action);
      }
      expect(
        (await sink.getPushes({ authorised: false }))
          .filter((push) => ids.includes(push.id))
          .map((push) => push.id),
      ).toEqual([ids[2], ids[0]]);
      expect(
        (await sink.getPushes({ authorised: true }))
          .filter((push) => ids.includes(push.id))
          .map((push) => push.id),
      ).toEqual([ids[1]]);
    });

    it('projects profile activity for both authors and reviewers', async () => {
      const authored = makePush(ids[0]);
      const reviewed = makePush(ids[1]);
      reviewed.userEmail = 'someone-else@example.com';
      reviewed.attestation = attestation;
      reviewed.timestamp = 200;
      const unrelated = makePush(ids[2]);
      unrelated.userEmail = 'unrelated@example.com';
      for (const action of [authored, reviewed, unrelated]) await sink.writeAudit(action);

      const summaries = await sink.getPushesForUserProfile(['author@example.com'], 'reviewer');
      expect(summaries.filter((push) => ids.includes(push.id)).map((push) => push.id)).toEqual([
        ids[1],
        ids[0],
      ]);
      expect(JSON.stringify(summaries)).not.toContain('private payload');
      expect(summaries.find((push) => push.id === reviewed.id)?.attestation?.reviewer).toEqual(
        attestation.reviewer,
      );
      const reviewOnly = await sink.getPushesForUserProfile([], 'REVIEWER');
      expect(reviewOnly.filter((push) => ids.includes(push.id)).map((push) => push.id)).toEqual([
        ids[1],
      ]);
    });

    it('preserves full legacy records through review decisions and cancellation', async () => {
      await sink.writeAudit(makePush());
      await sink.authorise(ids[0], attestation);
      expect(await sink.getPush(ids[0])).toMatchObject({
        authorised: true,
        canceled: false,
        rejected: false,
      });
      await sink.reject(ids[0], rejection);
      expect(await sink.getPush(ids[0])).toMatchObject({
        authorised: false,
        canceled: false,
        rejected: true,
      });
      await sink.cancel(ids[0]);

      const detail = await sink.getPush(ids[0]);
      expect(detail).toMatchObject({ authorised: false, canceled: true, rejected: false });
      expect(detail?.steps[0].content).toBe(diff);
      expect(detail?.steps[0].logs).toEqual([`diff - ${diff}`]);
      expect(detail?.attestation?.reviewer).toEqual(attestation.reviewer);
      expect(detail?.rejection?.reason).toBe(rejection.reason);
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
      action.url = 'git@EXAMPLE.com:storage-contract/REPO.git';
      await sink.writeAudit(action);
      expect(
        (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(canonicalRemoteUrl(url))
          ?.pending,
      ).toBe(1);
      action.url = 'https://example.com/storage-contract/moved.git';
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
  });
};
