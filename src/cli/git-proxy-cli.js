const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');

// Git-Proxy UI URL (configurable via environment variable)
const { GIT_PROXY_UI_URL = 'http://localhost:8080' } = process.env;
const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';

/**
 * Function to login to Git Proxy
 * @param {*} username The user name to login with
 * @param {*} password The password to use for the login
 */
async function login(username, password) {
  try {
    const response = await axios.post(
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

    fs.writeFileSync(
      GIT_PROXY_COOKIE_FILE,
      JSON.stringify(response.headers['set-cookie']),
      'utf8',
    );
    console.log(`Auth '${username}': OK`);
  } catch (error) {
    if (error.response) {
      console.error(`Error: Auth '${username}': '${error.response.status}'`);
    } else {
      console.error(`Error: Auth '${username}': '${error.message}'`);
    }
    process.exit(1);
  }
}

/**
 * Function to approve commit
 * @param {*} commitId The ID of the commit to approve
 */
async function approveCommit(commitId) {
  if (!fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    console.error('Error: Authentication required');
    process.exit(1);
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
      } else if (error.response.status == 404) {
        console.log(`Approve: ID: '${commitId}': Not Found`);
      } else {
        console.error(`Error: Approve: '${error.response.status}'`);
      }
    } else {
      console.error(`Error: Approve: '${error.message}'`);
    }
    process.exit(1);
  }
}

/**
 * Function to log out
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
