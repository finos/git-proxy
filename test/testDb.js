// This test needs to run first
const chai = require('chai');
const db = require('../src/db');

const { expect } = chai;

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git'
};
const TEST_USER = {
  username: "db-u1",
  password: "abc",
  gitAccount: "db-tes-user",
  email: "db-test@test.com",
  admin: true,
  oidcId: null
};

const TEST_PUSH = {};

/**
 * Clean up response data from the DB by removing an extraneous properties, 
 * allowing comparison with expect.
 * @param {object} example Example element from which columns to retain are extracted
 * @param {array} responses Array of responses to clean.
 * @return {array}  Array of cleaned up responses.
 */
const cleanResponseData = (example, responses) => {
  const columns = Object.keys(example);
  return responses.map((response)=> {
    return columns.reduce((obj, k) => { obj[k] = response[k]; }, {});
  });
};

// Use this test as a template
describe('Database client', async () => {
  
  before(async function () {});

  it('should be able to create a repo', async function () {
    await db.createRepo(TEST_REPO);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.deep.include.members(TEST_REPO);
  });

  it('should be able to delete a repo', async function () {
    await db.deleteRepo(TEST_REPO.name);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.not.deep.include.members(TEST_REPO);
  });

  it('should be able to create a user', async function () {
    await db.createUser(TEST_USER.username, TEST_USER.password, TEST_USER.email, TEST_USER.gitAccount, TEST_USER.admin);
    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(TEST_USER, users);
    expect(cleanUsers).to.deep.include.members(TEST_USER);
  });

  it('should be able to delete a user', async function () {
    await db.deleteUser(TEST_USER.username);
    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(TEST_USER, users);
    expect(cleanUsers).to.not.deep.include.members(TEST_USER);
  });

  it('should be able to create a push', async function () {
    await db.createPush(TEST_PUSH);
    const pushes = await db.getPushes();
    const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
    expect(cleanPushes).to.deep.include.members(TEST_PUSH);
  });

  it('should be able to delete a push', async function () {
    await db.deletePush(TEST_PUSH.id);
    const pushes = await db.getPushes();
    const cleanPushes = cleanResponseData(TEST_PUSH, pushes);
    expect(cleanPushes).to.not.deep.include.members(TEST_PUSH);
  });

  after(async function () {});
});
