const config = require('../config');

console.log(JSON.stringify(config.getDatabase()));

if (config.getDatabase().type === 'fs') {
  sink = require('../db/file');
  console.log('using local file database');
}

if (config.getDatabase().type === 'mongo') {
  sink = require('../db/mongo');
  console.log('using mongo db');
}

module.exports.createUser = async (
    username, password, email,
    canPull=false, canPush=false, canAuthorise=false, admin=false) => {
  const data = {
    username: username,
    password: password,
    email: email,
    admin: admin,
    canPull: canPull,
    canPush: canPush,
    canAuthorise: canAuthorise,
    changePassword: true,
  };

  const existingUser = await sink.findUser(username);

  if (existingUser) {
    const errorMessage = `user ${username} already exists`;
    throw new Error(errorMessage);
  }

  sink.createUser(data);
};

// The module exports
module.exports.authorise = sink.authorise;
module.exports.reject = sink.reject;
module.exports.cancel = sink.cancel;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findUser = sink.findUser;
module.exports.deleteUser = sink.deleteUser;
module.exports.updateUser = sink.updateUser;
module.exports.getRepos = sink.getRepos;
module.exports.getRepo = sink.getRepo;
module.exports.createRepo = sink.createRepo;
module.exports.addUserCanPush = sink.addUserCanPush;
module.exports.addUserCanAuthorise = sink.addUserCanAuthorise;
module.exports.deleteRepo = sink.deleteRepo;
