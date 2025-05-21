/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
  findUserByOIDC,
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
