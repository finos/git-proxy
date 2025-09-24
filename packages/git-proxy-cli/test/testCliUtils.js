const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);
const { expect } = require('chai');

const actions = require('../../../src/proxy/actions/Action');
const steps = require('../../../src/proxy/actions/Step');
const processor = require('../../../src/proxy/processors/push-action/audit');
const db = require('../../../src/db');

// cookie file name
const GIT_PROXY_COOKIE_FILE = 'git-proxy-cookie';

/**
 * @async
 * @param {string} cli - The CLI command to be executed.
 * @param {number} expectedExitCode - The expected exit code after the command
 *        execution. Typically, `0` for successful execution.
 * @param {string} expectedMessages - The array of expected messages included
 *        in the output after the command execution.
 * @param {string} expectedErrorMessages - The array of expected messages
 *        included in the error output after the command execution.
 * @param {boolean} debug - Flag to enable detailed logging for debugging.
 * @throws {AssertionError} Throws an error if the actual exit code does not
 *         match the `expectedExitCode`.
 */
async function runCli(
  cli,
  expectedExitCode = 0,
  expectedMessages = null,
  expectedErrorMessages = null,
  debug = true,
) {
  try {
    console.log(`cli: '${cli}'`);
    const { stdout, stderr } = await execAsync(cli);
    if (debug) {
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    }
    expect(0).to.equal(expectedExitCode);
    if (expectedMessages) {
      expectedMessages.forEach((expectedMessage) => {
        expect(stdout).to.include(expectedMessage);
      });
    }
    if (expectedErrorMessages) {
      expectedErrorMessages.forEach((expectedErrorMessage) => {
        expect(stderr).to.include(expectedErrorMessage);
      });
    }
  } catch (error) {
    const exitCode = error.code;
    if (!exitCode) {
      // an AssertionError is thrown from failing some of the expectations
      // in the 'try' block: forward it to Mocha to process
      throw error;
    }
    if (debug) {
      console.log(`error.stdout: ${error.stdout}`);
      console.log(`error.stderr: ${error.stderr}`);
    }
    expect(exitCode).to.equal(expectedExitCode);
    if (expectedMessages) {
      expectedMessages.forEach((expectedMessage) => {
        expect(error.stdout).to.include(expectedMessage);
      });
    }
    if (expectedErrorMessages) {
      expectedErrorMessages.forEach((expectedErrorMessage) => {
        expect(error.stderr).to.include(expectedErrorMessage);
      });
    }
  } finally {
    if (debug) {
      console.log(`cli: '${cli}': done`);
    }
  }
}

/**
 * Starts the server.
 * @param {Object} service - The GitProxy API service to be started.
 * @return {Promise<void>} A promise that resolves when the service has
 * successfully started. Does not return any value upon resolution.
 */
async function startServer(service) {
  await service.start();
}

/**
 * Closes the specified HTTP server gracefully. This function wraps the
 * `close` method of the `http.Server` instance in a promise to facilitate
 * async/await usage. It ensures the server stops accepting new connections
 * and terminates existing ones before shutting down.
 *
 * @param {http.Server} server - The `http.Server` instance to close.
 * @param {number} waitTime - The wait time after close.
 * @return {Promise<void>} A promise that resolves when the server has been
 * successfully closed, or rejects if an error occurs during closure. The
 * promise does not return any value upon resolution.
 *
 * @throws {Error} If the server cannot be closed properly or if an error
 * occurs during the close operation.
 */
async function closeServer(server, waitTime = 0) {
  return new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((err) => {
      if (err) {
        console.error('Failed to close the server:', err);
        reject(err); // Reject the promise if there's an error
      } else {
        setTimeout(() => {
          console.log(`Server closed successfully (wait time ${waitTime}).`);
          resolve(); // Resolve the promise when the server is closed
        }, waitTime);
      }
    });
  });
}

/**
 * Create local cookies file with an expired connect cookie.
 */
async function createCookiesFileWithExpiredCookie() {
  await removeCookiesFile();
  const cookies = [
    'connect.sid=s%3AuWjJK_VGFbX9-03UfvoSt_HFU3a0vFOd.jd986YQ17Bw4j1xGJn2l9yiF3QPYhayaYcDqGsNgQY4; Path=/; HttpOnly',
  ];
  fs.writeFileSync(GIT_PROXY_COOKIE_FILE, JSON.stringify(cookies), 'utf8');
}

/**
 * Remove local cookies file.
 */
async function removeCookiesFile() {
  if (fs.existsSync(GIT_PROXY_COOKIE_FILE)) {
    fs.unlinkSync(GIT_PROXY_COOKIE_FILE);
  }
}

/**
 * Add a new repo to the database.
 * @param {object} newRepo The new repo attributes.
 * @param {boolean} debug Print debug messages to console if true.
 */
async function addRepoToDb(newRepo, debug = false) {
  const repos = await db.getRepos();
  const found = repos.find((y) => y.project === newRepo.project && newRepo.name === y.name);
  if (!found) {
    await db.createRepo(newRepo);
    const repo = await db.getRepoByUrl(newRepo.url);
    await db.addUserCanPush(repo._id, 'admin');
    await db.addUserCanAuthorise(repo._id, 'admin');
    if (debug) {
      console.log(`New repo added to database: ${newRepo}`);
    }
  } else {
    if (debug) {
      console.log(`New repo already found in database: ${newRepo}`);
    }
  }
}

/**
 * Removes a repo from the DB.
 * @param {string} repoUrl  The url of the repo to remove.
 */
async function removeRepoFromDb(repoUrl) {
  const repo = await db.getRepoByUrl(repoUrl);
  await db.deleteRepo(repo._id);
}

/**
 * Add a new git push record to the database.
 * @param {string} id The ID of the git push.
 * @param {string} repoUrl The repository URL of the git push.
 * @param {string} user The user who pushed the git push.
 * @param {string} userEmail The email of the user who pushed the git push.
 * @param {boolean} debug Flag to enable logging for debugging.
 */
async function addGitPushToDb(id, repoUrl, user = null, userEmail = null, debug = false) {
  const action = new actions.Action(
    id,
    'push', // type
    'get', // method
    Date.now(), // timestamp
    repoUrl,
  );
  action.user = user;
  action.userEmail = userEmail;
  const step = new steps.Step(
    'authBlock', // stepName
    false, // error
    null, // errorMessage
    true, // blocked
    `\n\n\nGitProxy has received your push:\n\nhttp://localhost:8080/requests/${id}\n\n\n`, // blockedMessage
    null, // content
  );
  const commitData = [];
  commitData.push({
    tree: 'tree test',
    parent: 'parent',
    author: 'author',
    committer: 'committer',
    commitTs: 'commitTs',
    message: 'message',
  });
  action.commitData = commitData;
  action.addStep(step);
  const result = await processor.exec(null, action);
  if (debug) {
    console.log(`New git push added to DB: ${util.inspect(result)}`);
  }
}

/**
 * Removes a push from the DB
 * @param {string} id
 */
async function removeGitPushFromDb(id) {
  await db.deletePush(id);
}

/**
 * Add new user record to the database.
 * @param {string} username The user name.
 * @param {string} password The user password.
 * @param {string} email The user email.
 * @param {string} gitAccount The user git account.
 * @param {boolean} admin Flag to make the user administrator.
 * @param {boolean} debug Flag to enable logging for debugging.
 */
async function addUserToDb(username, password, email, gitAccount, admin = false, debug = false) {
  const result = await db.createUser(username, password, email, gitAccount, admin);
  if (debug) {
    console.log(`New user added to DB: ${util.inspect(result)}`);
  }
}

/**
 * Remove a user record from the database if present.
 * @param {string} username The user name.
 */
async function removeUserFromDb(username) {
  await db.deleteUser(username);
}

module.exports = {
  runCli: runCli,
  startServer: startServer,
  closeServer: closeServer,
  addRepoToDb: addRepoToDb,
  removeRepoFromDb: removeRepoFromDb,
  addGitPushToDb: addGitPushToDb,
  removeGitPushFromDb: removeGitPushFromDb,
  addUserToDb: addUserToDb,
  removeUserFromDb: removeUserFromDb,
  createCookiesFileWithExpiredCookie: createCookiesFileWithExpiredCookie,
  removeCookiesFile: removeCookiesFile,
};
