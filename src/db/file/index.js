const pushes = require('./pushes');
const users = require('./users');
const repo = require('./repo');

module.exports.getPushes = pushes.getPushes;
module.exports.writeAudit = pushes.writeAudit;
module.exports.getPush = pushes.getPush;
module.exports.authorise = pushes.authorise;
module.exports.cancel = pushes.cancel;
module.exports.reject = pushes.reject;
module.exports.canUserCancelPush = pushes.canUserCancelPush;
module.exports.canUserApproveRejectPush = pushes.canUserApproveRejectPush;

module.exports.findUser = users.findUser;
module.exports.findUserByOIDC = users.findUserByOIDC;
module.exports.getUsers = users.getUsers;
module.exports.createUser = users.createUser;
module.exports.deleteUser = users.deleteUser;
module.exports.updateUser = users.updateUser;

module.exports.getRepos = repo.getRepos;
module.exports.getRepo = repo.getRepo;
module.exports.createRepo = repo.createRepo;
module.exports.addUserCanPush = repo.addUserCanPush;
module.exports.addUserCanAuthorise = repo.addUserCanAuthorise;
module.exports.removeUserCanPush = repo.removeUserCanPush;
module.exports.removeUserCanAuthorise = repo.removeUserCanAuthorise;
module.exports.deleteRepo = repo.deleteRepo;
module.exports.isUserPushAllowed = repo.isUserPushAllowed;
module.exports.canUserApproveRejectPushRepo = repo.canUserApproveRejectPushRepo;
