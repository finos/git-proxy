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

export const isUserPushAllowed = async (url: string, user: string) => {
  user = user.toLowerCase();
  return new Promise<boolean>(async (resolve) => {
    const repo = await getRepoByUrl(url);
    if (!repo) {
      resolve(false);
      return;
    }

    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const canUserApproveRejectPush = async (id: string, user: string) => {
  return new Promise(async (resolve) => {
    const action = await getPush(id);
    if (!action) {
      resolve(false);
      return;
    }

    const theRepo = await sink.getRepoByUrl(action.url);

    if (theRepo.users.canAuthorise.includes(user)) {
      console.log(`user ${user} can approve/reject for repo ${action.url}`);
      resolve(true);
    } else {
      console.log(`user ${user} cannot approve/reject for repo ${action.url}`);
      resolve(false);
    }
  });
};

export const canUserCancelPush = async (id: string, user: string) => {
  return new Promise(async (resolve) => {
    const action = await getPush(id);
    if (!action) {
      resolve(false);
      return;
    }

    const isAllowed = await isUserPushAllowed(action.url, user);

    if (isAllowed) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
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
  getRepoById,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanAuthorise,
  removeUserCanPush,
  deleteRepo,
  getSessionStore,
} = sink;
