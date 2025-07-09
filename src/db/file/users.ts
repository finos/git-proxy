import fs from 'fs';
import Datastore from '@seald-io/nedb';
import { PublicKeyRecord, User } from '../types';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */
if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
/* istanbul ignore if */
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/users.db', autoload: true });

// Using a unique constraint with the index
db.ensureIndex({ fieldName: 'username', unique: true });
db.ensureIndex({ fieldName: 'email', unique: true });
db.setAutocompactionInterval(COMPACTION_INTERVAL);

export const findUser = (username: string) => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ username: username.toLowerCase() }, (err: Error | null, doc: User) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc || null);
      }
    });
  });
};

export const findUserByOIDC = function (oidcId: string) {
  return new Promise((resolve, reject) => {
    db.findOne({ oidcId: oidcId }, (err, doc) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc || null);
      }
    });
  });
};

export const createUser = function (user: User) {
  if (!user.publicKeys) {
    user.publicKeys = [];
  }

  user.username = user.username.toLowerCase();
  user.email = user.email.toLowerCase();
  return new Promise((resolve, reject) => {
    db.insert(user, (err) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(user);
      }
    });
  });
};

export const deleteUser = (username: string) => {
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

export const updateUser = (user: User) => {
  if (!user.publicKeys) {
    user.publicKeys = [];
  }

  user.username = user.username.toLowerCase();
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
            resolve(null);
          }
        });
      }
    });
  });
};

export const getUsers = (query: any = {}) => {
  if (query.username) {
    query.username = query.username.toLowerCase();
  }
  if (query.email) {
    query.email = query.email.toLowerCase();
  }
  return new Promise<User[]>((resolve, reject) => {
    db.find(query, (err: Error, docs: User[]) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) reject(err);
      else resolve(docs);
    });
  });
};

export const getPublicKeys = (username: string): Promise<PublicKeyRecord[]> => {
  return findUser(username).then((user) => {
    if (!user) {
      throw new Error('User not found');
    }
    return Array.isArray(user.publicKeys) ? user.publicKeys : [];
  });
};

export const addPublicKey = (username: string, record: PublicKeyRecord): Promise<User> =>
  new Promise<User>((resolve, reject) => {
    findUser(username)
      .then((user) => {
        if (!user) {
          reject(new Error('User not found'));
          return;
        }
        if (!Array.isArray(user.publicKeys)) user.publicKeys = [];

        const exists = user.publicKeys.some((r) => r.key === record.key);
        if (exists) return resolve(user);

        user.publicKeys.push({
          ...record,
          addedAt: record.addedAt ?? new Date().toISOString(),
        });

        updateUser(user)
          .then(() => resolve(user))
          .catch(reject);
      })
      .catch(reject);
  });

export const removePublicKey = function (username: string, canonicalKey: string) {
  return new Promise<User>((resolve, reject) => {
    findUser(username)
      .then((user) => {
        if (!user) {
          reject(new Error('User not found'));
          return;
        }

        if (!Array.isArray(user.publicKeys)) {
          user.publicKeys = [];
          return resolve(user);
        }

        const before = user.publicKeys.length;
        user.publicKeys = user.publicKeys.filter((rec) => rec.key !== canonicalKey);

        if (user.publicKeys.length === before) {
          return reject(new Error('SSH key not found'));
        }

        updateUser(user)
          .then(() => resolve(user))
          .catch(reject);
      })
      .catch(reject);
  });
};

export const findUserBySSHKey = (sshKey: string): Promise<User | null> =>
  new Promise((resolve, reject) => {
    db.findOne({ 'publicKeys.key': sshKey }, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(doc as User);
        }
      }
    });
  });
