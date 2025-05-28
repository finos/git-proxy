import fs from 'fs';
import Datastore from '@seald-io/nedb';
import { User } from '../types';

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/users.db', autoload: true });

export const findUser = (username: string) => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ username: username }, (err: Error | null, doc: User) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc || null);
      }
    });
  });
};

export const findUserByOIDC = (oidcId: string) => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ oidcId }, (err, doc: User) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc || null);
      }
    });
  });
};

export const createUser = (user: User) => {
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
  return new Promise<User>((resolve, reject) => {
    db.insert(user, (err) => {
      if (err) reject(err);
      else resolve(user);
    });
  });
};

export const deleteUser = (username: string) => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ username }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const updateUser = (user: User) => {
  if (!user.publicKeys) user.publicKeys = [];
  return new Promise<null>((resolve, reject) => {
    const options = { multi: false, upsert: false };
    db.update({ username: user.username }, user, options, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });
};

export const getUsers = (query: any = {}) => {
  return new Promise<User[]>((resolve, reject) => {
    db.find(query, (err: Error, docs: User[]) => {
      if (err) reject(err);
      else resolve(docs);
    });
  });
};

export const addPublicKey = (username: string, publicKey: string) => {
  return new Promise<User>((resolve, reject) => {
    findUser(username)
      .then((user) => {
        if (!user) {
          reject(new Error('User not found'));
          return;
        }
        if (!user.publicKeys) user.publicKeys = [];
        if (!user.publicKeys.includes(publicKey)) {
          user.publicKeys.push(publicKey);
          updateUser(user).then(resolve).catch(reject);
        } else {
          resolve(user);
        }
      })
      .catch(reject);
  });
};

export const removePublicKey = (username: string, publicKey: string) => {
  return new Promise<User>((resolve, reject) => {
    findUser(username)
      .then((user) => {
        if (!user) {
          reject(new Error('User not found'));
          return;
        }
        if (!user.publicKeys) {
          user.publicKeys = [];
          resolve(user);
          return;
        }
        console.log('key to remove:', publicKey);
        user.publicKeys = user.publicKeys.filter((key) => key !== publicKey);
        console.log('publicKeys after removal:', user.publicKeys);
        updateUser(user).then(resolve).catch(reject);
      })
      .catch(reject);
  });
};

export const findUserBySSHKey = (sshKey: string) => {
  return new Promise<User | null>((resolve, reject) => {
    db.findOne({ publicKeys: sshKey }, (err, doc) => {
      if (err) reject(err);
      else resolve(doc || null);
    });
  });
};

export const getPublicKeys = (username: string): Promise<string[]> => {
  return findUser(username).then((user) => {
    if (!user) {
      throw new Error('User not found');
    }
    return user.publicKeys || [];
  });
};
