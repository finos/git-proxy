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
        if (!doc) {
          resolve(null);
        } else {
          resolve(doc);
        }
      }
    });
  });
};

export const findUserByOIDC = function (oidcId: string) {
  return new Promise((resolve, reject) => {
    db.findOne({ oidcId: oidcId }, (err, doc) => {
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

export const createUser = function (user: User) {
  return new Promise((resolve, reject) => {
    db.insert(user, (err) => {
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
    db.remove({ username: username }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const updateUser = (user: User) => {
  return new Promise((resolve, reject) => {
    const options = { multi: false, upsert: false };
    db.update({ username: user.username }, user, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const getUsers = (query: any = {}) => {
  return new Promise<User[]>((resolve, reject) => {
    db.find(query, (err: Error, docs: User[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    });
  });
};
