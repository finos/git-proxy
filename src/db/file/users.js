const fs = require('fs');
const Datastore = require('nedb');

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({filename: './.data/db/users.db', autoload: true});

exports.findUser = function(username) {
  return new Promise((resolve, reject) => {
    db.findOne({username: username}, (err, doc) => {
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

exports.createUser = function(data) {
  return new Promise((resolve, reject) => {
    db.insert(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

exports.deleteUser = function(username) {
  return new Promise((resolve, reject) => {
    db.remove({username: username}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

exports.updateUser = function(user) {
  return new Promise((resolve, reject) => {
    const options = {multi: false, upsert: false};
    db.update({username: user.username}, user, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

exports.getUsers = function(query) {
  if (!query) query={};
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
