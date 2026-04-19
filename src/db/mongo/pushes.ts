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

import { activityPrimaryStatusFromFlags } from '../../activity/activityPrimaryStatus';
import { canonicalRemoteUrl } from '../../activity/canonicalRemoteUrl';
import { connect, findDocuments, findOneDocument } from './helper';
import { Action } from '../../proxy/actions';
import { toClass } from '../helper';
import {
  PushQuery,
  RepoActivityTabCounts,
  RepoPushRollupsByCanonicalUrl,
  emptyRepoActivityTabCounts,
} from '../types';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';
import { buildUserProfilePushFilter } from '../userProfilePushQuery';

const collectionName = 'pushes';

function bumpCount(
  m: Map<string, RepoActivityTabCounts>,
  canonicalKey: string,
  tab: keyof RepoActivityTabCounts,
): void {
  if (!canonicalKey) {
    return;
  }
  let row = m.get(canonicalKey);
  if (!row) {
    row = emptyRepoActivityTabCounts();
    m.set(canonicalKey, row);
  }
  row[tab] += 1;
}

function bumpMaxTimestampMs(
  m: Map<string, number>,
  canonicalKey: string,
  timestamp: unknown,
): void {
  if (!canonicalKey) {
    return;
  }
  const ts = typeof timestamp === 'number' ? timestamp : NaN;
  if (!Number.isFinite(ts)) {
    return;
  }
  const prev = m.get(canonicalKey);
  if (prev === undefined || ts > prev) {
    m.set(canonicalKey, ts);
  }
}

/**
 * Scan all push rows: tab counts and max timestamps per canonical remote URL (matches Activity UI).
 * Uses a tight projection and in-Node canonicalization for DocumentDB compatibility.
 */
export const getRepoPushRollupsByCanonicalUrl =
  async (): Promise<RepoPushRollupsByCanonicalUrl> => {
    const collection = await connect(collectionName);
    const cursor = collection.find(
      { type: 'push' },
      {
        projection: {
          url: 1,
          error: 1,
          rejected: 1,
          canceled: 1,
          authorised: 1,
          blocked: 1,
          allowPush: 1,
          timestamp: 1,
        },
      },
    );
    const tabCounts = new Map<string, RepoActivityTabCounts>();
    const latestPendingReviewAtMs = new Map<string, number>();
    const latestPushAtMs = new Map<string, number>();
    for await (const doc of cursor) {
      const url = typeof doc.url === 'string' ? doc.url : '';
      const key = canonicalRemoteUrl(url);
      if (!key) {
        continue;
      }
      const tab = activityPrimaryStatusFromFlags({
        error: doc.error === true,
        rejected: doc.rejected === true,
        canceled: doc.canceled === true,
        authorised: doc.authorised === true,
        blocked: doc.blocked === true,
        allowPush: doc.allowPush === true,
      });
      bumpCount(tabCounts, key, tab);
      bumpMaxTimestampMs(latestPushAtMs, key, doc.timestamp);
      if (tab === 'pending') {
        bumpMaxTimestampMs(latestPendingReviewAtMs, key, doc.timestamp);
      }
    }
    return { tabCounts, latestPendingReviewAtMs, latestPushAtMs };
  };

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

/** Fields returned for push list / activity UIs (shared by getPushes and getPushesForUserProfile). */
const pushListProjection = {
  _id: 0,
  id: 1,
  allowPush: 1,
  attestation: 1,
  authorised: 1,
  blocked: 1,
  blockedMessage: 1,
  branch: 1,
  canceled: 1,
  commitData: 1,
  commitFrom: 1,
  commitTo: 1,
  error: 1,
  method: 1,
  project: 1,
  rejected: 1,
  rejection: 1,
  repo: 1,
  repoName: 1,
  timestamp: 1,
  type: 1,
  url: 1,
  userEmail: 1,
} as const;

export const getPushes = async (
  query: Partial<PushQuery> = defaultPushQuery,
): Promise<Action[]> => {
  return findDocuments<Action>(collectionName, query, {
    projection: pushListProjection,
    sort: { timestamp: -1 },
  });
};

export const getPushesForUserProfile = async (
  emailVariants: string[],
  profileUsername: string,
): Promise<Action[]> => {
  const filter = buildUserProfilePushFilter(emailVariants, profileUsername);
  return findDocuments<Action>(collectionName, filter, {
    projection: pushListProjection,
    sort: { timestamp: -1 },
  });
};

export const getPush = async (id: string): Promise<Action | null> => {
  const doc = await findOneDocument<Action>(collectionName, { id });
  return doc ? (toClass(doc, Action.prototype) as Action) : null;
};

export const deletePush = async function (id: string): Promise<void> {
  const collection = await connect(collectionName);
  await collection.deleteOne({ id });
};

export const writeAudit = async (action: Action): Promise<void> => {
  const data = JSON.parse(JSON.stringify(action));
  const options = { upsert: true };
  const collection = await connect(collectionName);
  delete data._id;
  if (typeof data.id !== 'string') {
    throw new Error('Invalid id');
  }
  await collection.updateOne({ id: data.id }, { $set: data }, options);
};

export const authorise = async (
  id: string,
  attestation?: CompletedAttestation,
): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }

  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  action.attestation = attestation;
  await writeAudit(action);
  return { message: `authorised ${id}` };
};

export const reject = async (id: string, rejection: Rejection): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  action.rejection = rejection;
  await writeAudit(action);
  return { message: `reject ${id}` };
};

export const cancel = async (id: string): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return { message: `canceled ${id}` };
};
