import { AuthorisedRepo } from '../config/types';
import { PushQuery, Repo, Sink, User } from './types';
import * as bcrypt from 'bcryptjs';
import * as config from '../config';
import * as mongo from './mongo';
import * as neDb from './file';
import { Action } from '../proxy/actions/Action';
import MongoDBStore from 'connect-mongo';

let sink: Sink;
if (config.getDatabase().type === 'mongo') {
  sink = mongo;
} else if (config.getDatabase().type === 'fs') {
  sink = neDb;
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

export const createRepo = async (repo: AuthorisedRepo) => {
  const toCreate = {
    ...repo,
    users: {
      canPush: [],
      canAuthorise: [],
    },
  };
  toCreate.name = repo.name.toLowerCase();

  console.log(`creating new repo ${JSON.stringify(toCreate)}`);

  // n.b. project name may be blank but not null for non-github and non-gitlab repos
  if (!toCreate.project) {
    toCreate.project = '';
  }
  if (isBlank(toCreate.name)) {
    throw new Error('Repository name cannot be empty');
  }
  if (isBlank(toCreate.url)) {
    throw new Error('URL cannot be empty');
  }

  return sink.createRepo(toCreate) as Promise<Required<Repo>>;
};

export const isUserPushAllowed = async (url: string, user: string) => {
  user = user.toLowerCase();
  return new Promise<boolean>(async (resolve) => {
    const repo = await getRepoByUrl(url);
    if (!repo) {
      resolve(false);
      return;
    }

    if (repo.users?.canPush.includes(user) || repo.users?.canAuthorise.includes(user)) {
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

    if (theRepo?.users?.canAuthorise?.includes(user)) {
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

export const getSessionStore = (): MongoDBStore | null =>
  sink.getSessionStore ? sink.getSessionStore() : null;
export const getPushes = (query: PushQuery): Promise<Action[]> => sink.getPushes(query);
export const writeAudit = (action: Action): Promise<void> => sink.writeAudit(action);
export const getPush = (id: string): Promise<Action | null> => sink.getPush(id);
export const deletePush = (id: string): Promise<void> => sink.deletePush(id);
export const authorise = (id: string, attestation: any): Promise<{ message: string }> =>
  sink.authorise(id, attestation);
export const cancel = (id: string): Promise<{ message: string }> => sink.cancel(id);
export const reject = (id: string): Promise<{ message: string }> => sink.reject(id);
export const getRepos = (query?: object): Promise<Repo[]> => sink.getRepos(query);
export const getRepo = (name: string): Promise<Repo | null> => sink.getRepo(name);
export const getRepoByUrl = (url: string): Promise<Repo | null> => sink.getRepoByUrl(url);
export const getRepoById = (_id: string): Promise<Repo | null> => sink.getRepoById(_id);
export const addUserCanPush = (_id: string, user: string): Promise<void> =>
  sink.addUserCanPush(_id, user);
export const addUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  sink.addUserCanAuthorise(_id, user);
export const removeUserCanPush = (_id: string, user: string): Promise<void> =>
  sink.removeUserCanPush(_id, user);
export const removeUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  sink.removeUserCanAuthorise(_id, user);
export const deleteRepo = (_id: string): Promise<void> => sink.deleteRepo(_id);
export const findUser = (username: string): Promise<User | null> => sink.findUser(username);
export const findUserByOIDC = (oidcId: string): Promise<User | null> => sink.findUserByOIDC(oidcId);
export const getUsers = (query?: object): Promise<User[]> => sink.getUsers(query);
export const deleteUser = (username: string): Promise<void> => sink.deleteUser(username);
export const updateUser = (user: User): Promise<void> => sink.updateUser(user);
