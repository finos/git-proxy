const fs = require('fs');
const Datastore = require('nedb');

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({filename: './.data/db/users.db', autoload: true});

exports.findUser = function(username, logger=console) {
  return new Promise((resolve, reject) => {
    console.log(`data.file:findUser(${username})`);
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
        console.error(`error creating user`);
        console.error(err);
        reject(err);
      } else {
        console.log(`created user ${username}`);
        resolve(data);
      }
    });
  });
};

exports.deleteUser = function(username, logger=console) {
  return new Promise((resolve, reject) => {
    console.log(`data.file:findUser(${username})`);
    db.deleteOne({username: username}, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
