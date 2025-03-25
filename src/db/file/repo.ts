import fs from 'fs';
import Datastore from '@seald-io/nedb';
import { Repo } from '../types';
import { toClass } from '../helper';
import _ from 'lodash';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */
if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
/* istanbul ignore if */
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/repos.db', autoload: true });

db.ensureIndex({ fieldName: 'url', unique: true });
db.ensureIndex({ fieldName: 'name', unique: false });
db.setAutocompactionInterval(COMPACTION_INTERVAL);

export const getRepos = async (query: any = {}): Promise<Repo[]> => {
  if (query?.name) {
    query.name = query.name.toLowerCase();
  }
  return new Promise<Repo[]>((resolve, reject) => {
    db.find(query, (err: Error, docs: Repo[]) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(
          _.chain(docs)
            .map((x) => toClass(x, Repo.prototype))
            .value(),
        );
      }
    });
  });
};

export const getRepo = async (name: string): Promise<Repo | null> => {
  name = name.toLowerCase();
  return new Promise<Repo | null>((resolve, reject) => {
    db.findOne({ name: name.toLowerCase() }, (err: Error | null, doc: Repo) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc ? toClass(doc, Repo.prototype) : null);
      }
    });
  });
};

export const getRepoByUrl = async (repoURL: string): Promise<Repo | null> => {
  return new Promise<Repo | null>((resolve, reject) => {
    db.findOne({ url: repoURL }, (err: Error | null, doc: Repo) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc ? toClass(doc, Repo.prototype) : null);
      }
    });
  });
};

export const getRepoById = async (_id: string): Promise<Repo | null> => {
  return new Promise<Repo | null>((resolve, reject) => {
    db.findOne({ _id: _id }, (err: Error | null, doc: Repo) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc ? toClass(doc, Repo.prototype) : null);
      }
    });
  });
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  return new Promise<Repo>((resolve, reject) => {
    db.insert(repo, (err, doc) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(doc ? toClass(doc, Repo.prototype) : null);
      }
    });
  });
};

export const addUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await getRepoById(_id);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    if (repo.users.canPush.includes(user)) {
      resolve();
      return;
    }
    repo.users.canPush.push(user);

    const options = { multi: false, upsert: false };
    db.update({ _id: _id }, repo, options, (err) => {
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

export const addUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await getRepoById(_id);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    if (repo.users.canAuthorise.includes(user)) {
      resolve();
      return;
    }

    repo.users.canAuthorise.push(user);

    const options = { multi: false, upsert: false };
    db.update({ _id: _id }, repo, options, (err) => {
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

export const removeUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await getRepoById(_id);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    repo.users.canAuthorise = repo.users.canAuthorise.filter((x: string) => x != user);

    const options = { multi: false, upsert: false };
    db.update({ _id: _id }, repo, options, (err) => {
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

export const removeUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await getRepoById(_id);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    repo.users.canPush = repo.users.canPush.filter((x) => x != user);

    const options = { multi: false, upsert: false };
    db.update({ _id: _id }, repo, options, (err) => {
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

export const deleteRepo = async (_id: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ _id: _id }, (err) => {
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
