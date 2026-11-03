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

import fs from 'fs';
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
const DATASTORE_FILES = ['users.db', 'repos.db', 'pushes.db'];

interface LazyStore {
  store: Datastore;
  ready: () => Promise<void>;
}

export const createFileSource = (dataDir: string = DEFAULT_DATA_DIR): MigrationSource => {
  // Fail fast on a wrong path rather than reporting a legitimately empty
  // backend: a missing directory, or one containing none of the fs sink's
  // datastores, is a misconfiguration, while an existing-but-empty datastore
  // is a real (empty) backend.
  if (!fs.existsSync(dataDir)) {
    throw new Error(`fs sink data directory does not exist: ${dataDir}`);
  }
  if (!DATASTORE_FILES.some((file) => fs.existsSync(path.join(dataDir, file)))) {
    throw new Error(`No fs sink datastores (${DATASTORE_FILES.join(', ')}) found in: ${dataDir}`);
  }

  // Loading is explicit (no autoload) so a corrupt datastore surfaces as a
  // clear error instead of being silently treated as empty.
  const load = (file: string): LazyStore => {
    const filename = path.join(dataDir, file);
    const store = new Datastore({ filename });
    let loading: Promise<void> | undefined;
    const ready = () =>
      (loading ??= store.loadDatabaseAsync().catch((err: unknown) => {
        throw new Error(
          `Failed to load ${filename}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }));
    return { store, ready };
  };

  const users = load('users.db');
  const repos = load('repos.db');
  const pushes = load('pushes.db');

  const readAll = async <T>({ store, ready }: LazyStore, proto: object): Promise<T[]> => {
    await ready();
    const docs = await store.findAsync<Record<string, unknown>>({});
    return docs.map((doc) => toClass(doc, proto) as T);
  };

  // NeDB keeps the whole datastore in memory regardless, so batching here only
  // shapes the write side to match the MigrationSource contract.
  const getPushBatches = (batchSize: number): AsyncIterable<Action[]> => ({
    async *[Symbol.asyncIterator]() {
      const all = await readAll<Action>(pushes, Action.prototype);
      for (let i = 0; i < all.length; i += batchSize) {
        yield all.slice(i, i + batchSize);
      }
    },
  });

  return {
    getUsers: () => readAll<User>(users, User.prototype),
    getRepos: () => readAll<Repo>(repos, Repo.prototype),
    getPushBatches,
    close: () => Promise.resolve(),
  };
};
