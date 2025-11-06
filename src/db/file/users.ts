import fs from 'fs';
import Datastore from '@seald-io/nedb';

import { User, UserQuery, PublicKeyRecord } from '../types';
import { DuplicateSSHKeyError, UserNotFoundError } from '../../errors/DatabaseErrors';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */
if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
/* istanbul ignore if */
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/users.db', autoload: true });

// Using a unique constraint with the index
try {
  db.ensureIndex({ fieldName: 'username', unique: true });
} catch (e) {
  console.error(
    'Failed to build a unique index of usernames. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
    e,
  );
}
try {
  db.ensureIndex({ fieldName: 'email', unique: true });
} catch (e) {
  console.error(
    'Failed to build a unique index of user email addresses. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
    e,
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
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
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

export const getUsers = (query: Partial<UserQuery> = {}): Promise<User[]> => {
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
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    });
  });
};

export const addPublicKey = (username: string, publicKey: PublicKeyRecord): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if this key already exists for any user
    findUserBySSHKey(publicKey)
      .then((existingUser) => {
        if (existingUser && existingUser.username.toLowerCase() !== username.toLowerCase()) {
          reject(new DuplicateSSHKeyError(existingUser.username));
          return;
        }

        // Key doesn't exist for other users
        return findUser(username);
      })
      .then((user) => {
        if (!user) {
          reject(new UserNotFoundError(username));
          return;
        }
        if (!user.publicKeys) {
          user.publicKeys = [];
        }

        // Check if key already exists (by key content or fingerprint)
        const keyExists = user.publicKeys.some(
          (k) =>
            k.key === publicKey.key || (k.fingerprint && k.fingerprint === publicKey.fingerprint),
        );

        if (keyExists) {
          reject(new Error('SSH key already exists'));
          return;
        }

        user.publicKeys.push(publicKey);
        updateUser(user)
          .then(() => resolve())
          .catch(reject);
      })
      .catch(reject);
  });
};

export const removePublicKey = (username: string, fingerprint: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    findUser(username)
      .then((user) => {
        if (!user) {
          reject(new Error('User not found'));
          return;
        }
        if (!user.publicKeys) {
          user.publicKeys = [];
          resolve();
          return;
        }
        user.publicKeys = user.publicKeys.filter((k) => k.fingerprint !== fingerprint);
        updateUser(user)
          .then(() => resolve())
          .catch(reject);
      })
      .catch(reject);
  });
};

export const findUserBySSHKey = (sshKey: string): Promise<User | null> => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ 'publicKeys.key': sshKey }, (err: Error | null, doc: User) => {
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

export const getPublicKeys = (username: string): Promise<PublicKeyRecord[]> => {
  return findUser(username).then((user) => {
    if (!user) {
      throw new Error('User not found');
    }
    return user.publicKeys || [];
  });
};
