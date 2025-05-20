import { Repo } from './types';

const bcrypt = require('bcryptjs');
const config = require('../config');
let sink: any;
if (config.getDatabase().type === 'mongo') {
  sink = require('./mongo');
} else if (config.getDatabase().type === 'fs') {
  sink = require('./file');
}

const isBlank = (str: string) => {
  return !str || /^\s*$/.test(str);
};

export const createUser = async (
  username: string,
  password: string,
  email: string,
  gitAccount: string,
  admin: boolean = false,
  oidcId: string = '',
) => {
  console.log(
    `creating user
        user=${username},
        gitAccount=${gitAccount}
        email=${email},
        admin=${admin}
        oidcId=${oidcId}`,
  );

  const data = {
    username: username,
    password: oidcId ? null : await bcrypt.hash(password, 10),
    gitAccount: gitAccount,
    email: email,
    admin: admin,
  };

  if (isBlank(username)) {
    const errorMessage = `username ${username} cannot be empty`;
    throw new Error(errorMessage);
  }

  if (isBlank(gitAccount)) {
    const errorMessage = `GitAccount ${gitAccount} cannot be empty`;
    throw new Error(errorMessage);
  }

  if (isBlank(email)) {
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

export const createRepo = async (repo: Repo) => {
  repo.name = repo.name.toLowerCase();
  repo.users = {
    canPush: [],
    canAuthorise: [],
  };

  console.log(`creating new repo ${JSON.stringify(repo)}`);

  if (isBlank(repo.project)) {
    throw new Error('Project name cannot be empty');
  }
  if (isBlank(repo.name)) {
    throw new Error('Repository name cannot be empty');
  }
  if (isBlank(repo.url)) {
    throw new Error('URL cannot be empty');
  }

  return sink.createRepo(repo);
};

export const getRepoByUrl = async (repoUrl: string) => {
  const response = await sink.getRepoByUrl(repoUrl);
  // backwards compatibility
  if (!response) {
    // parse github URLs into org and repo names and fallback to legacy retrieval by repo name
    const regex = /.*\/([\w_.-]+?)(\.git)?$/m;
    const match = regex.exec(repoUrl);
    let repoName = '';

    if (match && match[1]) {
      repoName = match[1];
    } else {
      const errorMessage = `Cannot parse repository name from ${repoUrl}`;
      throw new Error(errorMessage);
    }

    return sink.getRepo(repoName);
  }
  return response;
};

export const {
  authorise,
  reject,
  cancel,
  getPushes,
  writeAudit,
  getPush,
  deletePush,
  findUser,
  findUserByOIDC,
  getUsers,
  deleteUser,
  updateUser,
  getRepos,
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
