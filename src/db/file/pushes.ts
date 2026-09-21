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

import _ from 'lodash';
import Datastore from '@seald-io/nedb';
import { activityPrimaryStatusFromFlags } from '../../activity/activityPrimaryStatus';
import { canonicalRemoteUrl } from '../../activity/canonicalRemoteUrl';
import { Action } from '../../proxy/actions/Action';
import { toClass } from '../helper';
import {
  PushQuery,
  RepoActivityTabCounts,
  RepoPushRollupsByCanonicalUrl,
  emptyRepoActivityTabCounts,
} from '../types';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';
import { handleErrorAndLog } from '../../utils/errors';
import { buildUserProfilePushFilter } from '../userProfilePushQuery';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// export for testing purposes
export let db: Datastore;
if (process.env.NODE_ENV === 'test') {
  db = new Datastore({ inMemoryOnly: true, autoload: true });
} else {
  db = new Datastore({ filename: './.data/db/pushes.db', autoload: true });
}
try {
  db.ensureIndex({ fieldName: 'id', unique: true });
} catch (error: unknown) {
  handleErrorAndLog(
    error,
    'Failed to build a unique index of push id values. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
  );
}
db.setAutocompactionInterval(COMPACTION_INTERVAL);

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

type PushActivityProjection = {
  url?: string;
  error?: boolean;
  rejected?: boolean;
  canceled?: boolean;
  authorised?: boolean;
  blocked?: boolean;
  allowPush?: boolean;
  timestamp?: number;
};

export const getRepoPushRollupsByCanonicalUrl = (): Promise<RepoPushRollupsByCanonicalUrl> => {
  return new Promise((resolve, reject) => {
    db.find(
      { type: 'push' },
      {
        url: 1,
        error: 1,
        rejected: 1,
        canceled: 1,
        authorised: 1,
        blocked: 1,
        allowPush: 1,
        timestamp: 1,
      },
      (err, docs: PushActivityProjection[]) => {
        if (err) {
          reject(err);
          return;
        }
        const tabCounts = new Map<string, RepoActivityTabCounts>();
        const latestPendingReviewAtMs = new Map<string, number>();
        const latestPushAtMs = new Map<string, number>();
        for (const doc of docs) {
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
        resolve({ tabCounts, latestPendingReviewAtMs, latestPushAtMs });
      },
    );
  });
};

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

export const getPushes = (query: Partial<PushQuery>): Promise<Action[]> => {
  if (!query) query = defaultPushQuery;
  return new Promise((resolve, reject) => {
    db.find(query)
      .sort({ timestamp: -1 })
      .exec((err, docs) => {
        // ignore for code coverage as neDB rarely returns errors even for an invalid query
        /* istanbul ignore if */
        if (err) {
          reject(err);
        } else {
          resolve(
            _.chain(docs)
              .map((x) => toClass(x, Action.prototype))
              .value(),
          );
        }
      });
  });
};

export const getPushesForUserProfile = (
  emailVariants: string[],
  profileUsername: string,
): Promise<Action[]> => {
  const filter = buildUserProfilePushFilter(emailVariants, profileUsername);
  return new Promise((resolve, reject) => {
    db.find(filter)
      .sort({ timestamp: -1 })
      .exec((err, docs) => {
        /* istanbul ignore if */
        if (err) {
          reject(err);
        } else {
          resolve(
            _.chain(docs)
              .map((x) => toClass(x, Action.prototype))
              .value(),
          );
        }
      });
  });
};

export const getPush = async (id: string): Promise<Action | null> => {
  return new Promise<Action | null>((resolve, reject) => {
    db.findOne({ id: id }, (err, doc) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(toClass(doc, Action.prototype));
        }
      }
    });
  });
};

export const deletePush = async (id: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ id }, (err) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const writeAudit = async (action: Action): Promise<void> => {
  return new Promise((resolve, reject) => {
    const options = { multi: false, upsert: true };
    db.update({ id: action.id }, action, options, (err) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
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
  return { message: `cancel ${id}` };
};
