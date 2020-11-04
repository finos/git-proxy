const fs = require('fs');
const _ = require('lodash');
const Datastore = require('nedb');

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data')
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db')

const db = new Datastore({ filename: './.data/db/users.db', autoload: true });

exports.findUser = function(username, logger=console) {
  return new Promise((resolve, reject) => {
    console.log(`data.file:findUser(${username})`);
    db.findOne({username: username}, (err, doc) => {
      if (err)
        reject(err);
      else 
        if (!doc) 
          resolve(null);
        else 
          resolve(doc);
    });
  });
}

exports.createUser = function(username, password, logger=console) {
  const data = {
    username: username,
    password: password,
  };

  console.log(`data.file:createUser(${username})`);
  return new Promise((resolve, reject) => {
    db.insert(data, (err) => {
      if (err){
        console.error(`error creating user`);
        console.error(err);
        reject(err);
      }
      else
        console.log(`created user ${username}`)
        resolve(data);
    });
  });
}
