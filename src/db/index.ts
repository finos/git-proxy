/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { AuthorisedRepo } from '../config/generated/config';
import { PushQuery, Repo, RepoQuery, Sink, User, UserQuery } from './types';
import * as bcrypt from 'bcryptjs';
import * as config from '../config';
import * as mongo from './mongo';
import * as neDb from './file';
import { Action } from '../proxy/actions/Action';
import MongoDBStore from 'connect-mongo';
import { processGitUrl } from '../proxy/routes/helper';
import { initializeFolders } from './file/helper';

let _sink: Sink | null = null;

/** The start function is before any attempt to use the DB adaptor and causes the configuration
 * to be read. This allows the read of the config to be deferred, otherwise it will occur on
 * import.
 */
const start = () => {
  if (!_sink) {
    if (config.getDatabase().type === 'mongo') {
      console.log('Loading MongoDB database adaptor');
      _sink = mongo;
    } else if (config.getDatabase().type === 'fs') {
      console.log('Loading neDB database adaptor');
      initializeFolders();
      _sink = neDb;
    } else {
      console.error(`Unsupported database type: ${config.getDatabase().type}`);
      process.exit(1);
    }
  }
  return _sink;
};

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
    const errorMessage = `username cannot be empty`;
    throw new Error(errorMessage);
  }

  if (isBlank(gitAccount)) {
    const errorMessage = `gitAccount cannot be empty`;
    throw new Error(errorMessage);
  }

  if (isBlank(email)) {
    const errorMessage = `email cannot be empty`;
    throw new Error(errorMessage);
  }
  const sink = start();
  const existingUser = await sink.findUser(username);
  if (existingUser) {
    const errorMessage = `user ${username} already exists`;
    throw new Error(errorMessage);
  }

  const existingUserWithEmail = await sink.findUserByEmail(email);
  if (existingUserWithEmail) {
    const errorMessage = `A user with email ${email} already exists`;
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

  return start().createRepo(toCreate) as Promise<Required<Repo>>;
};

export const isUserPushAllowed = async (url: string, user: string) => {
  user = user.toLowerCase();
  const repo = await getRepoByUrl(url);
  if (!repo) {
    return false;
  }

  return repo.users?.canPush.includes(user) || repo.users?.canAuthorise.includes(user);
};

export const canUserApproveRejectPush = async (id: string, user: string) => {
  const action = await getPush(id);
  if (!action) {
    return false;
  }

  const theRepo = await start().getRepoByUrl(action.url);

  if (theRepo?.users?.canAuthorise?.includes(user)) {
    console.log(`user ${user} can approve/reject for repo ${action.url}`);
    return true;
  } else {
    console.log(`user ${user} cannot approve/reject for repo ${action.url}`);
    return false;
  }
};

export const canUserCancelPush = async (id: string, user: string) => {
  const action = await getPush(id);
  if (!action) {
    return false;
  }

  const isAllowed = await isUserPushAllowed(action.url, user);

  if (isAllowed) {
    return true;
  } else {
    return false;
  }
};

export const getSessionStore = (): MongoDBStore | undefined => start().getSessionStore();
export const getPushes = (query: Partial<PushQuery>): Promise<Action[]> => start().getPushes(query);
export const writeAudit = (action: Action): Promise<void> => start().writeAudit(action);
export const getPush = (id: string): Promise<Action | null> => start().getPush(id);
export const deletePush = (id: string): Promise<void> => start().deletePush(id);
export const authorise = (id: string, attestation: any): Promise<{ message: string }> =>
  start().authorise(id, attestation);
export const cancel = (id: string): Promise<{ message: string }> => start().cancel(id);
export const reject = (id: string, attestation: any): Promise<{ message: string }> =>
  start().reject(id, attestation);
export const getRepos = (query?: Partial<RepoQuery>): Promise<Repo[]> => start().getRepos(query);
export const getRepo = (name: string): Promise<Repo | null> => start().getRepo(name);
export const getRepoByUrl = (url: string): Promise<Repo | null> => start().getRepoByUrl(url);
export const getRepoById = (_id: string): Promise<Repo | null> => start().getRepoById(_id);
export const addUserCanPush = (_id: string, user: string): Promise<void> =>
  start().addUserCanPush(_id, user);
export const addUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  start().addUserCanAuthorise(_id, user);
export const removeUserCanPush = (_id: string, user: string): Promise<void> =>
  start().removeUserCanPush(_id, user);
export const removeUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  start().removeUserCanAuthorise(_id, user);
export const deleteRepo = (_id: string): Promise<void> => start().deleteRepo(_id);
export const findUser = (username: string): Promise<User | null> => start().findUser(username);
export const findUserByEmail = (email: string): Promise<User | null> =>
  start().findUserByEmail(email);
export const findUserByOIDC = (oidcId: string): Promise<User | null> =>
  start().findUserByOIDC(oidcId);
export const getUsers = (query?: Partial<UserQuery>): Promise<User[]> => start().getUsers(query);
export const deleteUser = (username: string): Promise<void> => start().deleteUser(username);

export const updateUser = (user: Partial<User>): Promise<void> => start().updateUser(user);
/**
 * Collect the Set of all host (host and port if specified) that we
 * will be proxying requests for, to be used to initialize the proxy.
 *
 * @return {string[]} an array of origins
 */

export const getAllProxiedHosts = async (): Promise<string[]> => {
  const repos = await getRepos();
  const origins = new Set<string>();
  repos.forEach((repo) => {
    const parsedUrl = processGitUrl(repo.url);
    if (parsedUrl) {
      origins.add(parsedUrl.host);
    } // failures are logged by parsing util fn
  });
  return Array.from(origins);
};

export type { PushQuery, Repo, Sink, User } from './types';
