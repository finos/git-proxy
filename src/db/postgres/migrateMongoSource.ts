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

import { MongoClient, MongoClientOptions } from 'mongodb';

import { Action } from '../../proxy/actions';
import { toClass } from '../helper';
import { Repo, User } from '../types';
import { MigrationSource } from './migrate';

/**
 * Build a read-only {@link MigrationSource} backed by a MongoDB instance.
 *
 * The connection is explicit (not the configured sink) so the importer can read
 * the legacy backend while the active sink points at the Postgres destination.
 * The caller owns the lifecycle and must `close()` the source when done.
 */
export const createMongoSource = async (
  connectionString: string,
  options: MongoClientOptions = {},
): Promise<MigrationSource> => {
  const client = new MongoClient(connectionString, options);
  await client.connect();
  const db = client.db();

  const readAll = async <T>(collection: string, proto: object): Promise<T[]> => {
    const docs = await db.collection(collection).find().toArray();
    // toClass drops mongo class identity; the ObjectId `_id` it carries through
    // is ignored by the Postgres writers, which assign fresh UUIDs.
    return docs.map((doc) => toClass(doc, proto) as T);
  };

  return {
    getUsers: () => readAll<User>('users', User.prototype),
    getRepos: () => readAll<Repo>('repos', Repo.prototype),
    getPushes: () => readAll<Action>('pushes', Action.prototype),
    close: () => client.close(),
  };
};
