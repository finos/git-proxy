const fs = require('fs');
const Datastore = require('nedb');

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({filename: './.data/db/repos.db', autoload: true});

exports.getRepos = async (query={}) => {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) {
        reject(err);
      } else {
        console.log(docs);
        resolve(docs);
      }
    });
  });
};

exports.getRepo = async (name) => {
  return new Promise((resolve, reject) => {
    db.findOne({name: name}, (err, doc) => {
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

    if (repo.users.canPush.includes(user)) resolve(null);
    repo.users.canPush.push(user);

    const options = {multi: false, upsert: false};
    db.update({name: name}, repo, options, (err) => {
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

    if (repo.users.canAuthorise.includes(user)) resolve(null);
    repo.users.canAuthorise.push(user);

    const options = {multi: false, upsert: false};
    db.update({name: name}, repo, options, (err) => {
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

    const options = {multi: false, upsert: false};
    db.update({name: name}, repo, options, (err) => {
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

    const options = {multi: false, upsert: false};
    db.update({name: name}, repo, options, (err) => {
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
    db.remove({name: name}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
