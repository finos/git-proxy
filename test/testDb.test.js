// This test needs to run first
const chai = require('chai');
const db = require('../src/db');

const { expect } = chai;

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git',
};

const TEST_USER = {
  username: 'db-u1',
  password: 'abc',
  gitAccount: 'db-test-user',
  email: 'db-test@test.com',
  admin: true,
};

const TEST_PUSH = {
  steps: [],
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  canceled: true,
  rejected: false,
  autoApproved: false,
  autoRejected: false,
  commitData: [],
  id: '0000000000000000000000000000000000000000__1744380874110',
  type: 'push',
  method: 'get',
  timestamp: 1744380903338,
  project: 'finos',
  repoName: 'db-test-repo.git',
  url: 'https://github.com/finos/db-test-repo.git',
  repo: 'finos/db-test-repo.git',
  user: 'db-test-user',
  userEmail: 'db-test@test.com',
  lastStep: null,
  blockedMessage:
    '\n\n\nGitProxy has received your push:\n\nhttp://localhost:8080/requests/0000000000000000000000000000000000000000__1744380874110\n\n\n',
  _id: 'GIMEz8tU2KScZiTz',
  attestation: null,
};

/**
 * Clean up response data from the DB by removing an extraneous properties,
 * allowing comparison with expect.
 * @param {object} example Example element from which columns to retain are extracted
 * @param {array} responses Array of responses to clean.
 * @return {array}  Array of cleaned up responses.
 */
const cleanResponseData = (example, responses) => {
  const columns = Object.keys(example);
  return responses.map((response) => {
    const cleanResponse = {};
    columns.forEach((col) => {
      cleanResponse[col] = response[col];
    });
    return cleanResponse;
  });
};

// Use this test as a template
describe('Database client', async () => {
  before(async function () {});

  it('should be able to create a repo', async function () {
    await db.createRepo(TEST_REPO);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.deep.include(TEST_REPO);
  });

  it('should be able to delete a repo', async function () {
    await db.deleteRepo(TEST_REPO.name);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.not.deep.include(TEST_REPO);
  });

  it('should be able to create a user', async function () {
    await db.createUser(
      TEST_USER.username,
      TEST_USER.password,
      TEST_USER.email,
      TEST_USER.gitAccount,
      TEST_USER.admin,
    );
    const users = await db.getUsers();
    console.log('TEST USER:', JSON.stringify(TEST_USER, null, 2));
    console.log('USERS:', JSON.stringify(users, null, 2));
    // remove password as it will have been hashed
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    console.log('CLEAN USERS:', JSON.stringify(cleanUsers, null, 2));
    expect(cleanUsers).to.deep.include(TEST_USER_CLEAN);
  });

  it('should be able to delete a user', async function () {
    await db.deleteUser(TEST_USER.username);
    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(TEST_USER, users);
    expect(cleanUsers).to.not.deep.include(TEST_USER);
  });

  it('should be able to create a push', async function () {
    await db.writeAudit(TEST_PUSH);
    const pushes = await db.getPushes();
    const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
    expect(cleanPushes).to.deep.include(TEST_PUSH);
  });

  it('should be able to delete a push', async function () {
    await db.deletePush(TEST_PUSH.id);
    const pushes = await db.getPushes();
    const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
    expect(cleanPushes).to.not.deep.include(TEST_PUSH);
  });

  after(async function () {});
});
