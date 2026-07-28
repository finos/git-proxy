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

import Datastore from '@seald-io/nedb';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// export for testing purposes
export let db: Datastore;
if (process.env.NODE_ENV === 'test') {
  db = new Datastore({ inMemoryOnly: true, autoload: true });
} else {
  db = new Datastore({ filename: './.data/db/migrations.db', autoload: true });
}
db.ensureIndex({ fieldName: 'id', unique: true });
db.setAutocompactionInterval(COMPACTION_INTERVAL);

export const getAppliedMigrations = (): Promise<string[]> => {
  return new Promise<string[]>((resolve, reject) => {
    db.find({}, (err: Error | null, docs: { id: string }[]) => {
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(docs.map((doc) => doc.id));
      }
    });
  });
};

export const recordMigration = (id: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    db.update({ id }, { id }, { upsert: true }, (err) => {
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const unrecordMigration = (id: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ id }, {}, (err) => {
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
