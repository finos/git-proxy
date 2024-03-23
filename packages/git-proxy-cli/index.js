#!/usr/bin/env node
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');

// Git-Proxy UI HOST and PORT (configurable via environment variable)
const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost' } = process.env;
const { GIT_PROXY_UI_PORT: uiPort } =
  require('@finos/git-proxy/src/config/env').Vars;
const GIT_PROXY_UI_URL = `${uiHost}:${uiPort}`;
const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';

// Set default timeout to 5 seconds
axios.defaults.timeout = 5000; 

/**
 * Log in to Git Proxy
 * @param {*} username The user name to login with
 * @param {*} password The password to use for the login
 */
async function login(username, password) {
  try {
    let response = await axios.post(
      `${GIT_PROXY_UI_URL}/auth/login`,
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

    response = await axios.get(`${GIT_PROXY_UI_URL}/auth/profile`, {
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
      process.exitCode = 2;
    } else {
      console.error(`Error: Login '${username}': '${error.message}'`);
      process.exitCode = 1;
    }
  }
}

/**
 * Approve commit by ID
 * @param {*} commitId The ID of the commit to approve
 */
async function approveCommit(commitId) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authentication required');
    process.exitCode = 1;
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(GIT_PROXY_COOKIE_FILE, 'utf8'));

    response = await axios.get(`${GIT_PROXY_UI_URL}/api/v1/push/${commitId}`, {
      headers: { Cookie: cookies },
    });

    response = await axios.post(
      `${GIT_PROXY_UI_URL}/api/v1/push/${commitId}/authorise`,
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
      process.exitCode = 1;
    }
  }
}

/**
 * Log out (and clean up)
 */
async function logout() {
  try {
    if (fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
      fs.writeFileSync(GIT_PROXY_COOKIE_FILE, '*** logged out ***', 'utf8');
      fs.unlinkSync(GIT_PROXY_COOKIE_FILE);
    }
    console.log('Logout: OK');
  } catch (error) {
    console.error(`Error: Logout: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`Git-Proxy URL: ${GIT_PROXY_UI_URL}`);

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
