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

import path from 'path';

import Datastore from '@seald-io/nedb';

import { Action } from '../../proxy/actions';
import { toClass } from '../helper';
import { Repo, User } from '../types';
import { MigrationSource } from './migrate';

// Where the `fs` sink keeps its NeDB datastores.
const DEFAULT_DATA_DIR = './.data/db';

/**
 * Build a read-only {@link MigrationSource} backed by the NeDB datastores the
 * `fs` sink writes. `dataDir` defaults to the location the sink uses
 * (`./.data/db`). Record `_id`s are ignored by the Postgres writers, which
 * assign fresh UUIDs.
 */
export const createFileSource = (dataDir: string = DEFAULT_DATA_DIR): MigrationSource => {
  const load = (file: string): Datastore =>
    new Datastore({ filename: path.join(dataDir, file), autoload: true });

  const users = load('users.db');
  const repos = load('repos.db');
  const pushes = load('pushes.db');

  const readAll = async <T>(store: Datastore, proto: object): Promise<T[]> => {
    const docs = await store.findAsync<Record<string, unknown>>({});
    return docs.map((doc) => toClass(doc, proto) as T);
  };

  return {
    getUsers: () => readAll<User>(users, User.prototype),
    getRepos: () => readAll<Repo>(repos, Repo.prototype),
    getPushes: () => readAll<Action>(pushes, Action.prototype),
    close: () => Promise.resolve(),
  };
};
