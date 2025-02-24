import fs from 'fs';
import Datastore from '@seald-io/nedb'
import { Action } from '../../proxy/actions/Action';
import { Repo } from '../types';

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/repos.db', autoload: true });

export const getRepos = async (query = {}) => {
  return new Promise<Repo[]>((resolve, reject) => {
    db.find({}, (err: Error, docs: Repo[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    });
  });
};

export const getRepo = async (name: string) => {
  return new Promise<Repo | null>((resolve, reject) => {
    db.findOne({ name }, (err: Error | null, doc: Repo) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
};


export const createRepo = async (repo: Repo) => {
  repo.users = {
    canPush: [],
    canAuthorise: [],
  };

  return new Promise<Repo>((resolve, reject) => {
    db.insert(repo, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
};

export const addUserCanPush = async (name: string, user: string) => {
  return new Promise(async (resolve, reject) => {
    const repo = await getRepo(name);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    if (repo.users.canPush.includes(user)) {
      resolve(null);
      return;
    }
    repo.users.canPush.push(user);

    const options = { multi: false, upsert: false };
    db.update({ name: name }, repo, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const addUserCanAuthorise = async (name: string, user: string) => {
  return new Promise(async (resolve, reject) => {
    const repo = await getRepo(name);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    if (repo.users.canAuthorise.includes(user)) {
      resolve(null);
      return;
    }

    repo.users.canAuthorise.push(user);

    const options = { multi: false, upsert: false };
    db.update({ name: name }, repo, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const removeUserCanAuthorise = async (name: string, user: string) => {
  return new Promise(async (resolve, reject) => {
    const repo = await getRepo(name);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    repo.users.canAuthorise = repo.users.canAuthorise.filter((x: string) => x != user);

    const options = { multi: false, upsert: false };
    db.update({ name: name }, repo, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const removeUserCanPush = async (name: string, user: string) => {
  return new Promise(async (resolve, reject) => {
    const repo = await getRepo(name);
    if (!repo) {
      reject(new Error('Repo not found'));
      return;
    }

    repo.users.canPush = repo.users.canPush.filter((x) => x != user);

    const options = { multi: false, upsert: false };
    db.update({ name: name }, repo, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const deleteRepo = async (name: string) => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ name: name }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const isUserPushAllowed = async (name: string, user: string) => {
  name = name.toLowerCase();
  return new Promise<boolean>(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const canUserApproveRejectPushRepo = async (name: string, user: string) => {
  name = name.toLowerCase();
  console.log(`checking if user ${user} can approve/reject for ${name}`);
  return new Promise<boolean>(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    if (repo.users.canAuthorise.includes(user)) {
      console.log(`user ${user} can approve/reject to repo ${name}`);
      resolve(true);
    } else {
      console.log(`user ${user} cannot approve/reject to repo ${name}`);
      resolve(false);
    }
  });
};
