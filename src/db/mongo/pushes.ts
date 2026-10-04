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

import { findDocuments, findOneDocument } from './helper';
import { activityCollections, activityState, deletePushWithActivity } from './repoActivity';
export { getRepoPushRollupsByCanonicalUrl } from './repoActivity';
import { Action } from '../../proxy/actions';
import { pushListProjection } from '../pushProjection';
import { compactPush, restorePush } from '../pushStorage';
import { PushQuery } from '../types';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';
import { buildUserProfilePushFilter } from '../userProfilePushQuery';

const collectionName = 'pushes';

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

export const getPushes = async (
  query: Partial<PushQuery> = defaultPushQuery,
): Promise<Action[]> => {
  return findDocuments<Action>(
    collectionName,
    { ...query, '_activity.deleted': { $ne: true } },
    {
      projection: pushListProjection,
      sort: { timestamp: -1 },
    },
  );
};

export const getPushesForUserProfile = async (
  emailVariants: string[],
  profileUsername: string,
): Promise<Action[]> => {
  const filter = buildUserProfilePushFilter(emailVariants, profileUsername);
  return findDocuments<Action>(
    collectionName,
    { ...filter, '_activity.deleted': { $ne: true } },
    {
      projection: pushListProjection,
      sort: { timestamp: -1 },
    },
  );
};

export const getPush = async (id: string): Promise<Action | null> => {
  const doc = await findOneDocument<Action>(collectionName, {
    id,
    '_activity.deleted': { $ne: true },
  });
  return doc ? restorePush(doc) : null;
};

export const deletePush = async function (id: string): Promise<void> {
  await deletePushWithActivity(id);
};

export const writeAudit = async (action: Action): Promise<void> => {
  const data = JSON.parse(JSON.stringify(compactPush(action)));
  const options = { upsert: true };
  const { pushes: collection } = await activityCollections();
  delete data._id;
  if (typeof data.id !== 'string') {
    throw new Error('Invalid id');
  }
  const unset: Record<string, ''> =
    data._lastStepIndex === undefined ? { _lastStepIndex: '' } : { lastStep: '' };
  const activity = activityState(action);
  await collection.updateOne(
    { id: data.id },
    {
      $set: {
        ...data,
        '_activity.key': activity.key,
        '_activity.tab': activity.tab,
        '_activity.timestamp': activity.timestamp,
        '_activity.revision': activity.revision,
        '_activity.dirty': true,
        '_activity.deleted': false,
      },
      $addToSet: { '_activity.keys': activity.key },
      $unset: unset,
    },
    options,
  );
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
