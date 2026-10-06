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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import * as pushes from '../../../src/db/mongo/pushes';
import { defineRepoActivityContract } from '../repoActivity.contract';
import { connect, resetConnection } from '../../../src/db/mongo/helper';
import * as mongoHelper from '../../../src/db/mongo/helper';
import { rebuildRepoPushRollups } from '../../../src/db/mongo/repoActivity';
import { Action, RequestType, Step } from '../../../src/proxy/actions';

describe.runIf(process.env.RUN_MONGO_TESTS === 'true')('MongoDB repository activity', () => {
  defineRepoActivityContract('MongoDB repository activity contract', pushes);

  const key = 'example.com/recovery/repo';
  const makePush = (id = 'recovery') => {
    const action = new Action(id, RequestType.PUSH, 'POST', 123, `https://${key}.git`);
    action.blocked = true;
    const step = new Step('diff');
    step.content = 'preserved payload';
    action.addStep(step);
    return action;
  };

  afterEach(() => vi.restoreAllMocks());

  it('retries initialization after index creation fails', async () => {
    const createIndex = vi
      .spyOn(Collection.prototype, 'createIndex')
      .mockRejectedValueOnce(new Error('index creation failed'));
    await expect(pushes.writeAudit(makePush())).rejects.toThrow('index creation failed');
    expect(await (await connect('pushes')).findOne({ id: 'recovery' })).toBeNull();
    await pushes.writeAudit(makePush());
    expect(createIndex).toHaveBeenCalledTimes(8);
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('rejects initialization if the connection disappears and succeeds on retry', async () => {
    vi.spyOn(mongoHelper, 'getDb').mockReturnValueOnce(null);
    await expect(pushes.writeAudit(makePush())).rejects.toThrow(
      'MongoDB connection is not available',
    );
    await pushes.writeAudit(makePush());
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('deletes a historical push before backfill and tolerates repeated deletion', async () => {
    await (await connect('pushes')).insertOne(JSON.parse(JSON.stringify(makePush())));
    await pushes.deletePush('recovery');
    const replace = vi.spyOn(Collection.prototype, 'replaceOne');
    await pushes.deletePush('recovery');
    expect(replace).not.toHaveBeenCalled();
    expect(await pushes.getPush('recovery')).toBeNull();
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.size).toBe(0);
    expect(await (await connect('pushes')).findOne({ id: 'recovery' })).toBeNull();
  });

  it.each([1, 3])('handles %i concurrent updates during deletion', async (conflicts) => {
    await pushes.writeAudit(makePush());
    const original = Collection.prototype.replaceOne;
    let attempts = 0;
    const replace = vi
      .spyOn(Collection.prototype, 'replaceOne')
      .mockImplementation(async function (filter, replacement, options) {
        if (this.collectionName === 'pushes' && attempts++ < conflicts) {
          await pushes.authorise('recovery');
        }
        return original.call(this, filter, replacement, options);
      });
    if (conflicts === 1) {
      await pushes.deletePush('recovery');
      expect(attempts).toBe(2);
      expect(await pushes.getPush('recovery')).toBeNull();
    } else {
      await expect(pushes.deletePush('recovery')).rejects.toThrow(
        'Push recovery changed repeatedly during deletion; retry the request',
      );
      expect(attempts).toBe(3);
      expect((await pushes.getPush('recovery'))?.authorised).toBe(true);
      expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.approved).toBe(
        1,
      );
      replace.mockRestore();
      await pushes.deletePush('recovery');
    }
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.size).toBe(0);
  });

  it('backfills non-push records without adding repository activity or leaving them dirty', async () => {
    const action = new Action('pull', RequestType.PULL, 'GET', 123, `https://${key}`);
    const collection = await connect('pushes');
    await collection.insertOne(JSON.parse(JSON.stringify(action)));
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.size).toBe(0);
    expect(await collection.findOne({ id: action.id })).toMatchObject({
      _activity: { key: '', dirty: false },
    });
    expect(await pushes.getPush(action.id)).toMatchObject(action);
  });

  it('retries when a summary becomes unfinished during an otherwise clean read', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    const summaries = await connect('repoPushActivity');
    const original = Collection.prototype.find;
    let interleaved = false;
    vi.spyOn(Collection.prototype, 'find').mockImplementation(function (filter, options) {
      const cursor = original.call(this, filter, options);
      if (
        !interleaved &&
        this.collectionName === 'repoPushActivity' &&
        !Object.keys(filter).length
      ) {
        interleaved = true;
        const toArray = cursor.toArray.bind(cursor);
        vi.spyOn(cursor, 'toArray').mockImplementationOnce(async () => {
          await pushes.authorise('recovery');
          await summaries.updateOne({ key }, { $set: { ready: false } });
          return toArray();
        });
      }
      return cursor;
    });
    const rollups = await pushes.getRepoPushRollupsByCanonicalUrl();
    expect(interleaved).toBe(true);
    expect(rollups.tabCounts.get(key)?.approved).toBe(1);
    expect(rollups.tabCounts.get(key)?.pending).toBe(0);
    expect(await summaries.findOne({ key })).toMatchObject({ ready: true });
  });

  it('backfills historical records without changing their audit data', async () => {
    const action = makePush();
    const collection = await connect('pushes');
    await collection.insertOne(JSON.parse(JSON.stringify(action)));
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
    expect(await pushes.getPush(action.id)).toMatchObject(action);
    expect(await collection.findOne({ id: action.id })).toMatchObject({
      steps: action.steps,
      lastStep: action.lastStep,
      _activity: { dirty: false },
    });
  });

  it('does not scan push history on unchanged repository reads', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    const find = vi.spyOn(Collection.prototype, 'find');
    await pushes.getRepoPushRollupsByCanonicalUrl();
    const queries = find.mock.calls
      .filter((_, index) => find.mock.contexts[index].collectionName === 'pushes')
      .map(([query]) => query);
    expect(queries).toEqual([
      { '_activity.dirty': { $exists: false } },
      { '_activity.dirty': true },
    ]);
    const collection = await connect('pushes');
    for (const query of queries) {
      const plan = await collection.find(query).explain('executionStats');
      expect(plan.executionStats.totalDocsExamined).toBe(0);
    }
  });

  it('keeps a concurrent approval dirty until a newer refresh includes it', async () => {
    await pushes.writeAudit(makePush());
    const original = Collection.prototype.updateOne;
    let interleaved = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(
      async function (filter, update, options) {
        if (
          !interleaved &&
          this.collectionName === 'repoPushActivity' &&
          update.$set?.ready === true
        ) {
          interleaved = true;
          await pushes.authorise('recovery');
        }
        return original.call(this, filter, update, options);
      },
    );
    const rollups = await pushes.getRepoPushRollupsByCanonicalUrl();
    expect(interleaved).toBe(true);
    expect(rollups.tabCounts.get(key)?.approved).toBe(1);
    expect(rollups.tabCounts.get(key)?.pending).toBe(0);
    expect(rollups.latestPendingReviewAtMs.has(key)).toBe(false);
  });

  it('prevents an older refresh from overwriting a newer completed refresh', async () => {
    await pushes.writeAudit(makePush());
    const original = Collection.prototype.updateOne;
    let interleaved = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(
      async function (filter, update, options) {
        if (
          !interleaved &&
          this.collectionName === 'repoPushActivity' &&
          update.$set?.ready === true
        ) {
          interleaved = true;
          await pushes.authorise('recovery');
          expect(
            (await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.approved,
          ).toBe(1);
        }
        return original.call(this, filter, update, options);
      },
    );
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.approved).toBe(1);
    const stored = await (await connect('repoPushActivity')).findOne({ key });
    expect(stored).toMatchObject({ ready: true, counts: { approved: 1, pending: 0 } });
  });

  it('recovers an interrupted refresh after reconnecting', async () => {
    await pushes.writeAudit(makePush());
    const original = Collection.prototype.updateOne;
    const update = vi
      .spyOn(Collection.prototype, 'updateOne')
      .mockImplementation(async function (filter, update, options) {
        if (this.collectionName === 'repoPushActivity' && update.$set?.ready === true) {
          throw new Error('interrupted refresh');
        }
        return original.call(this, filter, update, options);
      });
    await expect(pushes.getRepoPushRollupsByCanonicalUrl()).rejects.toThrow('interrupted refresh');
    update.mockRestore();
    await resetConnection();
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('deletes the audit immediately and recovers its pending counter update after a restart', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await pushes.deletePush('recovery');
    expect(await pushes.getPush('recovery')).toBeNull();
    expect(await pushes.getPushes({})).toEqual([]);
    const tombstone = await (await connect('pushes')).findOne({ id: 'recovery' });
    expect(tombstone).toMatchObject({ _activity: { deleted: true, dirty: true } });
    expect(JSON.stringify(tombstone)).not.toContain('preserved payload');
    await resetConnection();
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.has(key)).toBe(false);
    expect(await (await connect('pushes')).findOne({ id: 'recovery' })).toBeNull();
  });

  it('rebuilds missing derived summaries from the source records', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await (await connect('repoPushActivity')).deleteMany({});
    expect((await rebuildRepoPushRollups()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('counts concurrent retries of one push only once', async () => {
    await Promise.all(Array.from({ length: 10 }, () => pushes.writeAudit(makePush())));
    expect(await (await connect('pushes')).countDocuments({ id: 'recovery' })).toBe(1);
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('falls back to the source records after three refreshes under continuous writes', async () => {
    await pushes.writeAudit(makePush());
    const original = Collection.prototype.updateOne;
    let refreshes = 0;
    const update = vi
      .spyOn(Collection.prototype, 'updateOne')
      .mockImplementation(async function (filter, update, options) {
        if (this.collectionName === 'repoPushActivity' && update.$set?.ready === true) {
          refreshes++;
          if (refreshes % 2) await pushes.authorise('recovery');
          else await pushes.cancel('recovery');
        }
        return original.call(this, filter, update, options);
      });
    const rollups = await pushes.getRepoPushRollupsByCanonicalUrl();
    expect(refreshes).toBe(3);
    expect(rollups.tabCounts.get(key)?.approved).toBe(1);
    update.mockRestore();
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.approved).toBe(1);
  });

  it('does not purge a push recreated while its deletion is being summarized', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await pushes.deletePush('recovery');
    const original = Collection.prototype.deleteOne;
    let recreated = false;
    vi.spyOn(Collection.prototype, 'deleteOne').mockImplementation(
      async function (filter, options) {
        if (!recreated && this.collectionName === 'pushes') {
          recreated = true;
          await pushes.writeAudit(makePush());
        }
        return original.call(this, filter, options);
      },
    );
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
    expect((await pushes.getPush('recovery'))?.steps[0].content).toBe('preserved payload');
  });

  it('keeps previous counts and audit data when an audit write fails', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    const original = Collection.prototype.updateOne;
    const update = vi
      .spyOn(Collection.prototype, 'updateOne')
      .mockImplementation(async function (filter, update, options) {
        if (this.collectionName === 'pushes') throw new Error('write failed');
        return original.call(this, filter, update, options);
      });
    await expect(pushes.authorise('recovery')).rejects.toThrow('write failed');
    update.mockRestore();
    expect((await pushes.getPush('recovery'))?.authorised).toBe(false);
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });
});
