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

import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { connect, getDb } from './helper';
import {
  addActivity,
  emptyRepoSummary,
  pushActivity,
  pushActivityProjection,
  repoRollups,
  RepoActivityIndex,
  type PushActivity,
  type PushActivityRow,
  type RepoActivitySummary,
} from '../repoActivity';
import type { RepoPushRollupsByCanonicalUrl } from '../types';

export type ActivityState = PushActivity & {
  revision: string;
  keys: string[];
  dirty: boolean;
  deleted: boolean;
};

type ActivityDocument = PushActivityRow & { _activity?: ActivityState };
type StoredSummary = RepoActivitySummary & { revision: string; ready: boolean };
const initialized = new WeakMap<Db, Promise<void>>();

export const activityState = (row: PushActivityRow): ActivityState => {
  const activity = pushActivity(row) ?? { key: '', tab: 'pending', timestamp: null };
  return { ...activity, revision: randomUUID(), keys: [activity.key], dirty: true, deleted: false };
};

export const activityCollections = async () => {
  const pushes = await connect<ActivityDocument>('pushes');
  const summaries = await connect<StoredSummary>('repoPushActivity');
  const database = getDb();
  if (!database) throw new Error('MongoDB connection is not available');
  let initialization = initialized.get(database);
  if (!initialization) {
    initialization = Promise.all([
      pushes.createIndex({ id: 1 }, { unique: true }),
      pushes.createIndex({ '_activity.dirty': 1 }),
      pushes.createIndex({
        '_activity.key': 1,
        '_activity.deleted': 1,
        '_activity.tab': 1,
        '_activity.timestamp': 1,
      }),
      summaries.createIndex({ key: 1 }, { unique: true }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        initialized.delete(database);
        throw error;
      });
    initialized.set(database, initialization);
  }
  await initialization;
  return { pushes, summaries };
};

const backfillActivity = async (): Promise<void> => {
  const { pushes } = await activityCollections();
  const cursor = pushes.find(
    { '_activity.dirty': { $exists: false } },
    { projection: { ...pushActivityProjection, _id: 1 } },
  );
  for await (const row of cursor) {
    await pushes.updateOne(
      { _id: row._id, '_activity.dirty': { $exists: false } },
      { $set: { _activity: activityState(row) } },
    );
  }
};

const refreshRepository = async (key: string): Promise<boolean> => {
  const { pushes, summaries } = await activityCollections();
  const revision = randomUUID();
  // A newer refresh fences out stale snapshots, including work resumed after a crash.
  await summaries.updateOne({ key }, { $set: { revision, ready: false } }, { upsert: true });
  const summary = emptyRepoSummary(key);
  const cursor = pushes.find(
    { '_activity.key': key, '_activity.deleted': false },
    { projection: { _id: 0, '_activity.key': 1, '_activity.tab': 1, '_activity.timestamp': 1 } },
  );
  for await (const row of cursor) {
    if (row._activity) addActivity(summary, row._activity);
  }
  const result = await summaries.updateOne(
    { key, revision },
    { $set: { ...summary, ready: true } },
  );
  return result.matchedCount === 1;
};

const scanActivity = async (): Promise<RepoPushRollupsByCanonicalUrl> => {
  const { pushes } = await activityCollections();
  const index = new RepoActivityIndex();
  for await (const row of pushes.find(
    { '_activity.deleted': { $ne: true } },
    { projection: pushActivityProjection },
  )) {
    index.set(row.id, pushActivity(row));
  }
  return index.snapshot();
};

export const getRepoPushRollupsByCanonicalUrl =
  async (): Promise<RepoPushRollupsByCanonicalUrl> => {
    await backfillActivity();
    const { pushes, summaries } = await activityCollections();
    for (let attempt = 0; attempt < 3; attempt++) {
      const dirty = await pushes
        .find({ '_activity.dirty': true }, { projection: { _id: 1, _activity: 1 } })
        .toArray();
      const unfinished = await summaries
        .find({ ready: false }, { projection: { key: 1 } })
        .toArray();
      if (!dirty.length && !unfinished.length) {
        const rows = await summaries.find({}).toArray();
        if (rows.every((row) => row.ready)) return repoRollups(rows);
        continue;
      }
      const keys = new Set(unfinished.map((row) => row.key));
      for (const row of dirty) {
        for (const key of row._activity?.keys ?? []) if (key) keys.add(key);
      }
      const refreshed = new Set<string>();
      for (const key of keys) {
        if (await refreshRepository(key)) refreshed.add(key);
      }
      for (const row of dirty) {
        const activity = row._activity;
        if (!activity || activity.keys.some((key) => key && !refreshed.has(key))) continue;
        // Clear only the exact revision summarized above. Concurrent writes remain dirty.
        const filter = { _id: row._id, '_activity.revision': activity.revision };
        if (activity.deleted) {
          await pushes.deleteOne(filter);
        } else {
          await pushes.updateOne(filter, {
            $set: { '_activity.dirty': false, '_activity.keys': [activity.key] },
          });
        }
      }
    }
    // Bound request latency under continuous writes; the source rows remain authoritative.
    return scanActivity();
  };

export const deletePushWithActivity = async (id: string): Promise<void> => {
  const { pushes } = await activityCollections();
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await pushes.findOne(
      { id },
      {
        projection: { ...pushActivityProjection, _id: 1, _activity: 1 },
      },
    );
    if (!row || row._activity?.deleted) return;
    const previous = row._activity;
    const activity = previous ?? activityState(row);
    const result = await pushes.replaceOne(
      {
        _id: row._id,
        '_activity.revision': previous ? previous.revision : { $exists: false },
      },
      {
        id,
        _activity: { ...activity, revision: randomUUID(), dirty: true, deleted: true },
      },
    );
    if (result.matchedCount === 1) return;
  }
  throw new Error(`Push ${id} changed repeatedly during deletion; retry the request`);
};

export const rebuildRepoPushRollups = async (): Promise<RepoPushRollupsByCanonicalUrl> => {
  const { pushes, summaries } = await activityCollections();
  await backfillActivity();
  await summaries.updateMany({}, { $set: { ready: false } });
  await pushes.updateMany(
    {},
    {
      $set: { '_activity.dirty': true, '_activity.revision': randomUUID() },
    },
  );
  return getRepoPushRollupsByCanonicalUrl();
};
