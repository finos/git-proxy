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

import { connect, findOneDocument, paginatedFind } from './helper';
import { Action } from '../../proxy/actions';
import { toClass, buildSearchFilter, buildSort } from '../helper';
import { PaginatedResult, PaginationOptions, PushQuery } from '../types';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';

const collectionName = 'pushes';

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

const pushProjection = {
  _id: 0,
  id: 1,
  allowPush: 1,
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
  repo: 1,
  repoName: 1,
  timestamp: 1,
  type: 1,
  url: 1,
  user: 1,
};

export const getPushes = async (
  query: Partial<PushQuery> = defaultPushQuery,
  pagination?: PaginationOptions,
): Promise<PaginatedResult<Action>> => {
  const filter = buildSearchFilter(
    { ...query },
    ['repo', 'branch', 'commitTo', 'user'],
    pagination?.search,
  );
  const sort = buildSort(pagination, 'timestamp', -1, [
    'timestamp',
    'repo',
    'branch',
    'commitTo',
    'user',
  ]);
  const skip = pagination?.skip ?? 0;
  const limit = pagination?.limit ?? 0;

  const collection = await connect(collectionName);
  return paginatedFind<Action>(collection, filter, sort, skip, limit, pushProjection);
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
