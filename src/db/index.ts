const bcrypt = require('bcryptjs');
const config = require('../config');
let sink: any;
if (config.getDatabase().type === 'mongo') {
  sink = require('./mongo');
} else if (config.getDatabase().type === 'fs') {
  sink = require('./file');
}

export const createUser = async (
  username: string,
  password: string,
  email: string,
  gitAccount: string,
  admin: boolean = false
) => {
  console.log(
    `creating user
        user=${username},
        gitAccount=${gitAccount}
        email=${email},
        admin=${admin}`,
  );

  const data = {
    username: username,
    password: await bcrypt.hash(password, 10),
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

export const {
  authorise,
  reject,
  cancel,
  getPushes,
  writeAudit,
  getPush,
  findUser,
  getUsers,
  deleteUser,
  updateUser,
  getRepos,
  getRepo,
  createRepo,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanAuthorise,
  removeUserCanPush,
  deleteRepo,
  isUserPushAllowed,
  canUserApproveRejectPushRepo,
  canUserApproveRejectPush,
  canUserCancelPush,
  getSessionStore,
} = sink;
