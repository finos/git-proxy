#!/usr/bin/env node
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const util = require('util');

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
async function login(username, password) {
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
  } catch (error) {
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
 * @param {Object} filters - An object containing filter criteria for Git
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
async function getGitPushes(filters) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: List: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    const response = await axios.get(`${baseUrl}/api/v1/push/`, {
      headers: { Cookie: cookies },
      params: filters,
    });

    const records = [];
    response.data?.forEach((push) => {
      const record = {};
      record.id = push.id;
      record.timestamp = push.timestamp;
      record.url = push.url;
      record.allowPush = push.allowPush;
      record.authorised = push.authorised;
      record.blocked = push.blocked;
      record.canceled = push.canceled;
      record.error = push.error;
      record.rejected = push.rejected;

      record.lastStep = {
        stepName: push.lastStep?.stepName,
        error: push.lastStep?.error,
        errorMessage: push.lastStep?.errorMessage,
        blocked: push.lastStep?.blocked,
        blockedMessage: push.lastStep?.blockedMessage,
      };

      record.commitData = [];
      push.commitData?.forEach((pushCommitDataRecord) => {
        record.commitData.push({
          message: pushCommitDataRecord.message,
          committer: pushCommitDataRecord.committer,
        });
      });

      records.push(record);
    });

    console.log(`${util.inspect(records, false, null, false)}`);
  } catch (error) {
    // default error
    const errorMessage = `Error: List: '${error.message}'`;
    process.exitCode = 2;
    console.error(errorMessage);
  }
}

/**
 * Authorise git push by ID
 * @param {string} id The ID of the git push to authorise
 */
async function authoriseGitPush(id) {
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
  } catch (error) {
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
async function rejectGitPush(id) {
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
  } catch (error) {
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
async function cancelGitPush(id) {
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
  } catch (error) {
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
    } catch (error) {
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
  } catch (error) {
    const errorMessage = `Error: Reload config: '${error.message}'`;
    process.exitCode = 2;
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
        describe: `Filter for the "authorised" flag of the git push on the list`, // eslint-disable-line max-len
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
    description: 'Reload GitProxy configuration without restarting',
    action: reloadConfig,
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help().argv;
