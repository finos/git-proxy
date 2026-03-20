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
import Datastore from '@seald-io/nedb';

import { PaginatedResult, PaginationOptions, User, UserQuery } from '../types';
import { handleErrorAndLog } from '../../utils/errors';
import { buildSearchFilter, buildSort } from '../helper';
import { paginatedFind } from './helper';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */
if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
/* istanbul ignore if */
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

// export for testing purposes
export let db: Datastore;
if (process.env.NODE_ENV === 'test') {
  db = new Datastore({ inMemoryOnly: true, autoload: true });
} else {
  db = new Datastore({ filename: './.data/db/users.db', autoload: true });
}

// Using a unique constraint with the index
try {
  db.ensureIndex({ fieldName: 'username', unique: true });
} catch (error: unknown) {
  handleErrorAndLog(
    error,
    'Failed to build a unique index of usernames. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
  );
}
try {
  db.ensureIndex({ fieldName: 'email', unique: true });
} catch (error: unknown) {
  handleErrorAndLog(
    error,
    'Failed to build a unique index of user email addresses. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
  );
}
db.setAutocompactionInterval(COMPACTION_INTERVAL);

export const findUser = (username: string): Promise<User | null> => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ username: username.toLowerCase() }, (err: Error | null, doc: User) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(doc);
        }
      }
    });
  });
};

export const findUserByEmail = (email: string): Promise<User | null> => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ email: email.toLowerCase() }, (err: Error | null, doc: User) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(doc);
        }
      }
    });
  });
};

export const findUserByOIDC = function (oidcId: string): Promise<User | null> {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ oidcId: oidcId }, (err: Error | null, doc: User) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(doc);
        }
      }
    });
  });
};

export const createUser = function (user: User): Promise<void> {
  user.username = user.username.toLowerCase();
  user.email = user.email.toLowerCase();
  return new Promise((resolve, reject) => {
    db.insert(user, (err) => {
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

export const deleteUser = (username: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ username: username.toLowerCase() }, (err) => {
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

export const updateUser = (user: Partial<User>): Promise<void> => {
  if (user.username) {
    user.username = user.username.toLowerCase();
  }
  if (user.email) {
    user.email = user.email.toLowerCase();
  }

  return new Promise((resolve, reject) => {
    // The mongo db adaptor adds fields to existing documents, where this adaptor replaces the document
    //   hence, retrieve and merge documents to avoid dropping fields (such as the gitaccount)
    let existingUser;
    db.findOne({ username: user.username }, (err, doc) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          existingUser = {};
        } else {
          existingUser = doc;
        }

        Object.assign(existingUser, user);

        const options = { multi: false, upsert: true };
        db.update({ username: user.username }, existingUser, options, (err) => {
          // ignore for code coverage as neDB rarely returns errors even for an invalid query
          /* istanbul ignore if */
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
};

export const getUsers = (
  query: Partial<UserQuery> = {},
  pagination?: PaginationOptions,
): Promise<PaginatedResult<User>> => {
  if (query.username) {
    query.username = query.username.toLowerCase();
  }
  if (query.email) {
    query.email = query.email.toLowerCase();
  }

  const baseQuery = buildSearchFilter(
    { ...query },
    ['username', 'displayName', 'email', 'gitAccount'],
    pagination?.search,
  );
  const sort = buildSort(pagination, 'username', 1);
  const skip = pagination?.skip ?? 0;
  const limit = pagination?.limit ?? 0;

  return paginatedFind<User>(db, baseQuery, sort, skip, limit);
};
