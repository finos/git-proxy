const config = require('../config');
let sink;
if (config.getDatabase().type === 'mongo') {
  sink = require('../db/mongo');
} else if (config.getDatabase().type === 'fs') {
  sink = require('../db/file');
}

module.exports.createUser = async (username, password, email, gitAccount, admin = false) => {
  console.log(
    `creating user
        user=${username},
        gitAccount=${gitAccount}
        email=${email},
        admin=${admin}`,
  );

  const data = {
    username: username,
    gitAccount: gitAccount,
    email: email,
    admin: admin,
  };

  if (username === undefined || username === null || username === '') {
    const errorMessage = `username ${username} cannot be empty`;
    throw new Error(errorMessage);
  }

  if (gitAccount === undefined || gitAccount === null || gitAccount === '') {
    const errorMessage = `GitAccount ${gitAccount} cannot be empty`;
    throw new Error(errorMessage);
  }

  if (email === undefined || email === null || email === '') {
    const errorMessage = `Email ${email} cannot be empty`;
    throw new Error(errorMessage);
  }
  const existingUser = await sink.findUser(username);

  if (existingUser) {
    const errorMessage = `user ${username} already exists`;
    throw new Error(errorMessage);
  }

  await sink.createUser(data);
};

// The module exports
module.exports.authorise = sink.authorise;
module.exports.reject = sink.reject;
module.exports.cancel = sink.cancel;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findUser = sink.findUser;
module.exports.getUsers = sink.getUsers;
module.exports.deleteUser = sink.deleteUser;
module.exports.updateUser = sink.updateUser;
module.exports.getRepos = sink.getRepos;
module.exports.getRepo = sink.getRepo;
module.exports.createRepo = sink.createRepo;
module.exports.addUserCanPush = sink.addUserCanPush;
module.exports.addUserCanAuthorise = sink.addUserCanAuthorise;
module.exports.removeUserCanAuthorise = sink.removeUserCanAuthorise;
module.exports.removeUserCanPush = sink.removeUserCanPush;

module.exports.deleteRepo = sink.deleteRepo;
module.exports.isUserPushAllowed = sink.isUserPushAllowed;
module.exports.canUserApproveRejectPushRepo = sink.canUserApproveRejectPushRepo;
module.exports.canUserApproveRejectPush = sink.canUserApproveRejectPush;
module.exports.canUserCancelPush = sink.canUserCancelPush;
module.exports.getSessionStore = sink.getSessionStore;
