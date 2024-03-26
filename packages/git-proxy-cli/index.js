#!/usr/bin/env node
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');

const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';
// Git-Proxy UI HOST and PORT (configurable via environment variable)
const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost' } = process.env;
const { GIT_PROXY_UI_PORT: uiPort } =
  require('@finos/git-proxy/src/config/env').Vars;
const baseUrl = `${uiHost}:${uiPort}`;

axios.defaults.timeout = 30000;

/**
 * Log in to Git Proxy
 * @param {string} username The user name to login with
 * @param {string} password The password to use for the login
 */
async function login(username, password) {
  try {
    let response = await axios.post(
      `${baseUrl}/auth/login`,
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

    response = await axios.get(`${baseUrl}/auth/profile`, {
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
 * Approve commit by ID
 * @param {string} commitId The ID of the commit to approve
 */
async function approveCommit(commitId) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    response = await axios.get(`${baseUrl}/api/v1/push/${commitId}`, {
      headers: { Cookie: cookies },
    });

    response = await axios.post(
      `${baseUrl}/api/v1/push/${commitId}/authorise`,
      {},
      {
        headers: { Cookie: cookies },
      },
    );

    console.log(`Approve: ID: '${commitId}': OK`);
  } catch (error) {
    if (error.response) {
      if (error.response.status == 401) {
        console.log(`Approve: Authentication required`);
        process.exitCode = 2;
      } else if (error.response.status == 404) {
        console.log(`Approve: ID: '${commitId}': Not Found`);
        process.exitCode = 3;
      } else {
        console.error(`Error: Approve: '${error.response.status}'`);
        process.exitCode = 4;
      }
    } else {
      console.error(`Error: Approve: '${error.message}'`);
      process.exitCode = 5;
    }
  }
}

/**
 * Log out (and clean up)
 */
async function logout() {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    response = await axios.post(
      `${baseUrl}/auth/logout`,
      {},
      {
        headers: { Cookie: cookies },
      },
    );
    if (fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
      fs.writeFileSync(GIT_PROXY_COOKIE_FILE, '*** logged out ***', 'utf8');
      fs.unlinkSync(GIT_PROXY_COOKIE_FILE);
    }
    console.log('Logout: OK');
  } catch (error) {
    if (error.response) {
      if (error.response.status == 401) {
        console.log(`Logout: Authentication required`);
        process.exitCode = 2;
      } else {
        console.error(`Error: Logout: '${error.response.status}'`);
        process.exitCode = 3;
      }
    } else {
      console.error(`Error: Logout: '${error.message}'`);
      process.exitCode = 4;
    }
  }
}

console.log(`Git-Proxy URL: ${baseUrl}`);

// Parsing command line arguments
yargs(hideBin(process.argv))
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
    command: 'approve',
    describe: 'Approve commit by ID',
    builder: {
      commitId: {
        describe: 'Commit ID',
        demandOption: true,
        type: 'string',
      },
    },
    handler(argv) {
      approveCommit(argv.commitId);
    },
  })
  .command({
    command: 'logout',
    describe: 'Log out',
    handler(argv) {
      logout();
    },
  })
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help().argv;
