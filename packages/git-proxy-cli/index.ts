#!/usr/bin/env node

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

import axios from 'axios';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import util from 'util';

import { PushQuery } from '@finos/git-proxy/db';
import { Action } from '@finos/git-proxy/proxy/actions';

const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';
// GitProxy UI HOST and PORT (configurable via environment variable)
const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost', GIT_PROXY_UI_PORT: uiPort = 8080 } =
  process.env;

const baseUrl = `${uiHost}:${uiPort}`;

axios.defaults.timeout = 30000;

/**
 * Log in to GitProxy
 * @param {string} username The user name to login with
 * @param {string} password The password to use for the login
 */
async function login(username: string, password: string) {
  try {
    let response = await axios.post(
      `${baseUrl}/api/auth/login`,
      {
        username,
        password,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      },
    );
    const cookies = response.headers['set-cookie'];

    response = await axios.get(`${baseUrl}/api/auth/profile`, {
      headers: { Cookie: cookies },
      withCredentials: true,
    });

    fs.writeFileSync(GIT_PROXY_COOKIE_FILE, JSON.stringify(cookies), 'utf8');

    const user = `"${response.data.username}" <${response.data.email}>`;
    const isAdmin = response.data.admin ? ' (admin)' : '';
    console.log(`Login ${user}${isAdmin}: OK`);
  } catch (error: any) {
    if (error.response) {
      console.error(`Error: Login '${username}': '${error.response.status}'`);
      process.exitCode = 1;
    } else {
      console.error(`Error: Login '${username}': '${error.message}'`);
      process.exitCode = 2;
    }
  }
}

/**
 * Prints a JSON list of git pushes filtered based on specified criteria.
 * The function filters the pushes based on various statuses such as whether
 * the push is allowed, authorised, blocked, canceled, encountered an error,
 * or was rejected.
 *
 * @param {Partial<PushQuery>} filters - An object containing filter criteria for Git
 *          pushes.
 * @param {boolean} filters.allowPush - If not null, filters for pushes with
 *          given attribute and status.
 * @param {boolean} filters.authorised - If not null, filters for pushes with
 *          given attribute and status.
 * @param {boolean} filters.blocked - If not null, filters for pushes with
 *          given attribute and status.
 * @param {boolean} filters.canceled - If not null, filters for pushes with
 *          given attribute and status.
 * @param {boolean} filters.error - If not null, filters for pushes with given
 *          attribute and status.
 * @param {boolean} filters.rejected - If not null, filters for pushes with
 *          given attribute and status.
 */
async function getGitPushes(filters: Partial<PushQuery>) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: List: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));
    const { data } = await axios.get<Action[]>(`${baseUrl}/api/v1/push/`, {
      headers: { Cookie: cookies },
      params: filters,
    });

    const records = data.map((push: Action) => {
      const {
        id,
        repo,
        branch,
        commitFrom,
        commitTo,
        commitData,
        error,
        canceled,
        rejected,
        blocked,
        authorised,
        attestation,
        autoApproved,
        timestamp,
        url,
        allowPush,
        lastStep,
      } = push;

      return {
        id,
        repo,
        branch,
        commitFrom,
        commitTo,
        commitData: commitData?.map(
          ({
            message,
            committer,
            committerEmail,
            author,
            authorEmail,
            commitTimestamp,
            tree,
            parent,
          }) => ({
            message,
            committer,
            committerEmail,
            author,
            authorEmail,
            commitTimestamp,
            tree,
            parent,
          }),
        ),
        error,
        canceled,
        rejected,
        blocked,
        authorised,
        attestation,
        autoApproved,
        timestamp,
        url,
        allowPush,
        lastStep: lastStep && {
          id: lastStep.id,
          content: lastStep.content,
          logs: lastStep.logs,
          stepName: lastStep.stepName,
          error: lastStep.error,
          errorMessage: lastStep.errorMessage,
          blocked: lastStep.blocked,
          blockedMessage: lastStep.blockedMessage,
        },
      };
    });

    console.log(util.inspect(records, false, null, false));
  } catch (error: any) {
    console.error(`Error: List: '${error.message}'`);
    process.exitCode = 2;
  }
}

/**
 * Authorise git push by ID
 * @param {string} id The ID of the git push to authorise
 */
async function authoriseGitPush(id: string) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authorise: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    await axios.get(`${baseUrl}/api/v1/push/${id}`, {
      headers: { Cookie: cookies },
    });

    await axios.post(
      `${baseUrl}/api/v1/push/${id}/authorise`,
      {
        params: {
          attestation: [
            {
              label: 'Authorising via GitProxy CLI',
              checked: true,
            },
          ],
        },
      },
      {
        headers: { Cookie: cookies },
      },
    );

    console.log(`Authorise: ID: '${id}': OK`);
  } catch (error: any) {
    // default error
    let errorMessage = `Error: Authorise: '${error.message}'`;
    process.exitCode = 2;

    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = 'Error: Authorise: Authentication required';
          process.exitCode = 3;
          break;
        case 404:
          errorMessage = `Error: Authorise: ID: '${id}': Not Found`;
          process.exitCode = 4;
      }
    }
    console.error(errorMessage);
  }
}

/**
 * Reject git push by ID
 * @param {string} id The ID of the git push to reject
 */
async function rejectGitPush(id: string) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Reject: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    await axios.get(`${baseUrl}/api/v1/push/${id}`, {
      headers: { Cookie: cookies },
    });

    await axios.post(
      `${baseUrl}/api/v1/push/${id}/reject`,
      {},
      {
        headers: { Cookie: cookies },
      },
    );

    console.log(`Reject: ID: '${id}': OK`);
  } catch (error: any) {
    // default error
    let errorMessage = `Error: Reject: '${error.message}'`;
    process.exitCode = 2;

    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = 'Error: Reject: Authentication required';
          process.exitCode = 3;
          break;
        case 404:
          errorMessage = `Error: Reject: ID: '${id}': Not Found`;
          process.exitCode = 4;
      }
    }
    console.error(errorMessage);
  }
}

/**
 * Cancel git push by ID
 * @param {string} id The ID of the git push to cancel
 */
async function cancelGitPush(id: string) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Cancel: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    await axios.get(`${baseUrl}/api/v1/push/${id}`, {
      headers: { Cookie: cookies },
    });

    await axios.post(
      `${baseUrl}/api/v1/push/${id}/cancel`,
      {},
      {
        headers: { Cookie: cookies },
      },
    );

    console.log(`Cancel: ID: '${id}': OK`);
  } catch (error: any) {
    // default error
    let errorMessage = `Error: Cancel: '${error.message}'`;
    process.exitCode = 2;

    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = 'Error: Cancel: Authentication required';
          process.exitCode = 3;
          break;
        case 404:
          errorMessage = `Error: Cancel: ID: '${id}': Not Found`;
          process.exitCode = 4;
      }
    }
    console.error(errorMessage);
  }
}

/**
 * Log out (and clean up)
 */
async function logout() {
  if (fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));
      fs.writeFileSync(GIT_PROXY_COOKIE_FILE, '*** logged out ***', 'utf8');
      fs.unlinkSync(GIT_PROXY_COOKIE_FILE);

      await axios.post(
        `${baseUrl}/api/auth/logout`,
        {},
        {
          headers: { Cookie: cookies },
        },
      );
    } catch (error: any) {
      console.log(`Warning: Logout: '${error.message}'`);
    }
  }

  console.log('Logout: OK');
}

/**
 * Reloads the GitProxy configuration without restarting the process
 */
async function reloadConfig() {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Reload config: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    await axios.post(`${baseUrl}/api/v1/admin/reload-config`, {}, { headers: { Cookie: cookies } });

    console.log('Configuration reloaded successfully');
  } catch (error: any) {
    const errorMessage = `Error: Reload config: '${error.message}'`;
    process.exitCode = 2;
    console.error(errorMessage);
  }
}

/**
 * Create a new user
 * @param {string} username The username for the new user
 * @param {string} password The password for the new user
 * @param {string} email The email for the new user
 * @param {string} gitAccount The git account for the new user
 * @param {boolean} [admin=false] Whether the user should be an admin (optional)
 */
async function createUser(
  username: string,
  password: string,
  email: string,
  gitAccount: string,
  admin: boolean = false,
) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Create User: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    await axios.post(
      `${baseUrl}/api/auth/create-user`,
      {
        username,
        password,
        email,
        gitAccount,
        admin,
      },
      {
        headers: { Cookie: cookies },
      },
    );

    console.log(`User '${username}' created successfully`);
  } catch (error: any) {
    let errorMessage = `Error: Create User: '${error.message}'`;
    process.exitCode = 2;

    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = 'Error: Create User: Authentication required';
          process.exitCode = 3;
          break;
        case 400:
          errorMessage = `Error: Create User: ${error.response.data.message}`;
          process.exitCode = 4;
          break;
      }
    }
    console.error(errorMessage);
  }
}

// Parsing command line arguments
yargs(hideBin(process.argv)) // eslint-disable-line @typescript-eslint/no-unused-expressions
  .command({
    command: 'authorise',
    describe: 'Authorise git push by ID',
    builder: {
      id: {
        describe: 'Push ID',
        demandOption: true,
        type: 'string',
      },
    },
    handler(argv) {
      authoriseGitPush(argv.id);
    },
  })
  .command({
    command: 'cancel',
    describe: 'Cancel git push by ID',
    builder: {
      id: {
        describe: 'Push ID',
        demandOption: true,
        type: 'string',
      },
    },
    handler(argv) {
      cancelGitPush(argv.id);
    },
  })
  .command({
    command: 'config',
    describe: 'Print configuration',
    handler() {
      console.log(`GitProxy URL: ${baseUrl}`);
    },
  })
  .command({
    command: 'login',
    describe: 'Log in by username/password',
    builder: {
      username: {
        describe: 'Username',
        demandOption: true,
        type: 'string',
      },
      password: {
        describe: 'Password',
        demandOption: true,
        type: 'string',
      },
    },
    handler(argv) {
      login(argv.username, argv.password);
    },
  })
  .command({
    command: 'logout',
    describe: 'Log out',
    handler() {
      logout();
    },
  })
  .command({
    command: 'ls',
    describe: 'Get list of git pushes',
    builder: {
      allowPush: {
        describe: `Filter for the "allowPush" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
      authorised: {
        describe: `Filter for the "authorised" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
      blocked: {
        describe: `Filter for the "blocked" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
      canceled: {
        describe: `Filter for the "canceled" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
      error: {
        describe: `Filter for the "error" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
      rejected: {
        describe: `Filter for the "rejected" flag of the git push on the list`,
        demandOption: false,
        type: 'boolean',
        default: null,
      },
    },
    handler(argv) {
      const filters = {
        allowPush: argv.allowPush,
        authorised: argv.authorised,
        blocked: argv.blocked,
        canceled: argv.canceled,
        error: argv.error,
        rejected: argv.rejected,
      };
      getGitPushes(filters);
    },
  })
  .command({
    command: 'reject',
    describe: 'Reject git push by ID',
    builder: {
      id: {
        describe: 'Push ID',
        demandOption: true,
        type: 'string',
      },
    },
    handler(argv) {
      rejectGitPush(argv.id);
    },
  })
  .command({
    command: 'reload-config',
    describe: 'Reload GitProxy configuration without restarting',
    handler() {
      reloadConfig();
    },
  })
  .command({
    command: 'create-user',
    describe: 'Create a new user',
    builder: {
      username: {
        describe: 'Username for the new user',
        demandOption: true,
        type: 'string',
      },
      password: {
        describe: 'Password for the new user',
        demandOption: true,
        type: 'string',
      },
      email: {
        describe: 'Email for the new user',
        demandOption: true,
        type: 'string',
      },
      gitAccount: {
        describe: 'Git account for the new user',
        demandOption: true,
        type: 'string',
      },
      admin: {
        describe: 'Whether the user should be an admin (optional)',
        demandOption: false,
        type: 'boolean',
        default: false,
      },
    },
    handler(argv) {
      createUser(argv.username, argv.password, argv.email, argv.gitAccount, argv.admin);
    },
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help().argv;
