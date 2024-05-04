const fs = require('fs');
const Datastore = require('@seald-io/nedb');

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/repos.db', autoload: true });

exports.getRepos = async (query = {}) => {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    });
  });
};

exports.getRepo = async (name) => {
  return new Promise((resolve, reject) => {
    db.findOne({ name: name }, (err, doc) => {
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

exports.getRepoByUrl = async (url) => {
  return new Promise((resolve, reject) => {
    db.findOne({ url: url }, (err, doc) => {
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

exports.createRepo = async (repo) => {
  repo.users = {
    canPush: [],
    canAuthorise: [],
  };

  return new Promise((resolve, reject) => {
    db.insert(repo, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
};

exports.addUserCanPush = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);

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

exports.addUserCanAuthorise = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);

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

exports.removeUserCanAuthorise = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);

    repo.users.canAuthorise = repo.users.canAuthorise.filter((x) => x != user);

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

exports.removeUserCanPush = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);

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

exports.deleteRepo = async (name) => {
  return new Promise((resolve, reject) => {
    db.remove({ name: name }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

exports.isUserPushAllowed = async (url, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepoByUrl(url);
    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

exports.canUserApproveRejectPushRepo = async (name, user) => {
  name = name.toLowerCase();
  console.log(`checking if user ${user} can approve/reject for ${name}`);
  return new Promise(async (resolve, reject) => {
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
