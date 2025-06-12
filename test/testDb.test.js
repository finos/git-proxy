// This test needs to run first
const chai = require('chai');
const db = require('../src/db');
const { Repo, User } = require('../src/db/types');
const { Action } = require('../src/proxy/actions/Action');
const { Step } = require('../src/proxy/actions/Step');

const { expect } = chai;

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git',
};

const TEST_NONEXISTENT_REPO = {
  project: 'MegaCorp',
  name: 'repo',
  url: 'https://example.com/MegaCorp/MegaGroup/repo.git',
  _id: 'ABCDEFGHIJKLMNOP',
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
  url: TEST_REPO.url,
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
 * @param {array | object} responses Array of responses to clean.
 * @return {array}  Array of cleaned up responses.
 */
const cleanResponseData = (example, responses) => {
  const columns = Object.keys(example);

  if (Array.isArray(responses)) {
    return responses.map((response) => {
      const cleanResponse = {};
      columns.forEach((col) => {
        cleanResponse[col] = response[col];
      });
      return cleanResponse;
    });
  } else if (typeof responses === 'object') {
    const cleanResponse = {};
    columns.forEach((col) => {
      cleanResponse[col] = responses[col];
    });
    return cleanResponse;
  } else {
    throw new Error(`Can only clean arrays or objects, but a ${typeof responses}  was passed`);
  }
};

// Use this test as a template
describe('Database clients', async () => {
  before(async function () {});

  it('should be able to construct a repo instance', async function () {
    const repo = new Repo('project', 'name', 'https://github.com/finos.git-proxy.git', null, 'id');
    expect(repo._id).to.equal('id');
    expect(repo.project).to.equal('project');
    expect(repo.name).to.equal('name');
    expect(repo.url).to.equal('https://github.com/finos.git-proxy.git');
    expect(repo.users).to.deep.equals({ canPush: [], canAuthorise: [] });

    const repo2 = new Repo(
      'project',
      'name',
      'https://github.com/finos.git-proxy.git',
      { canPush: ['bill'], canAuthorise: ['ben'] },
      'id',
    );
    expect(repo2.users).to.deep.equals({ canPush: ['bill'], canAuthorise: ['ben'] });
  });

  it('should be able to construct a user instance', async function () {
    const user = new User(
      'username',
      'password',
      'gitAccount',
      'email@domain.com',
      true,
      null,
      'id',
    );
    expect(user.username).to.equal('username');
    expect(user.username).to.equal('username');
    expect(user.gitAccount).to.equal('gitAccount');
    expect(user.email).to.equal('email@domain.com');
    expect(user.admin).to.equal(true);
    expect(user.oidcId).to.be.null;
    expect(user._id).to.equal('id');

    const user2 = new User(
      'username',
      'password',
      'gitAccount',
      'email@domain.com',
      false,
      'oidcId',
      'id',
    );
    expect(user2.admin).to.equal(false);
    expect(user2.oidcId).to.equal('oidcId');
  });

  it('should be able to construct a valid action instance', async function () {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos/git-proxy.git',
    );
    expect(action.project).to.equal('finos');
    expect(action.repoName).to.equal('git-proxy.git');
  });

  it('should be able to block an action by adding a blocked step', async function () {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos.git-proxy.git',
    );
    const step = new Step('stepName', false, null, false, null);
    step.setAsyncBlock('blockedMessage');
    action.addStep(step);
    expect(action.blocked).to.be.true;
    expect(action.blockedMessage).to.equal('blockedMessage');
    expect(action.getLastStep()).to.deep.equals(step);
    expect(action.continue()).to.be.false;
  });

  it('should be able to error an action by adding a step with an error', async function () {
    const action = new Action(
      'id',
      'type',
      'method',
      Date.now(),
      'https://github.com/finos.git-proxy.git',
    );
    const step = new Step('stepName', true, 'errorMessage', false, null);
    action.addStep(step);
    expect(action.error).to.be.true;
    expect(action.errorMessage).to.equal('errorMessage');
    expect(action.getLastStep()).to.deep.equals(step);
    expect(action.continue()).to.be.false;
  });

  it('should be able to create a repo', async function () {
    await db.createRepo(TEST_REPO);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.deep.include(TEST_REPO);
  });

  it('should be able to filter repos', async function () {
    // uppercase the filter value to confirm db client is lowercasing inputs
    const repos = await db.getRepos({ name: TEST_REPO.name.toUpperCase() });
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos[0]).to.eql(TEST_REPO);

    const repos2 = await db.getRepos({ url: TEST_REPO.url });
    const cleanRepos2 = cleanResponseData(TEST_REPO, repos2);
    expect(cleanRepos2[0]).to.eql(TEST_REPO);

    // passing an empty query should produce same results as no query
    const repos3 = await db.getRepos();
    const repos4 = await db.getRepos({});
    expect(repos3).to.have.same.deep.members(repos4);
  });

  it('should be able to retrieve a repo by url', async function () {
    const repo = await db.getRepoByUrl(TEST_REPO.url);
    const cleanRepo = cleanResponseData(TEST_REPO, repo);
    expect(cleanRepo).to.eql(TEST_REPO);
  });

  it('should be able to retrieve a repo by id', async function () {
    // _id is autogenerated by the DB so we need to retrieve it before we can use it
    const repo = await db.getRepoByUrl(TEST_REPO.url);
    const repoById = await db.getRepoById(repo._id);
    const cleanRepo = cleanResponseData(TEST_REPO, repoById);
    expect(cleanRepo).to.eql(TEST_REPO);
  });

  it('should be able to delete a repo', async function () {
    // _id is autogenerated by the DB so we need to retrieve it before we can use it
    const repo = await db.getRepoByUrl(TEST_REPO.url);
    await db.deleteRepo(repo._id);
    const repos = await db.getRepos();
    const cleanRepos = cleanResponseData(TEST_REPO, repos);
    expect(cleanRepos).to.not.deep.include(TEST_REPO);
  });

  it('should NOT be able to create a repo with blank project, name or url', async function () {
    // test with a null value
    let threwError = false;
    let testRepo = {
      project: null,
      name: TEST_REPO.name,
      url: TEST_REPO.url,
    };
    try {
      await db.createRepo(testRepo);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;

    // test with an empty string
    threwError = false;
    testRepo = {
      project: '',
      name: TEST_REPO.name,
      url: TEST_REPO.url,
    };
    try {
      await db.createRepo(testRepo);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;

    // test with an undefined property
    threwError = false;
    testRepo = {
      name: TEST_REPO.name,
      url: TEST_REPO.url,
    };
    try {
      await db.createRepo(testRepo);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;

    // repeat tests for other fields, but don't both with all variations as they go through same fn
    threwError = false;
    testRepo = {
      project: TEST_REPO.project,
      name: null,
      url: TEST_REPO.url,
    };
    try {
      await db.createRepo(testRepo);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;

    testRepo = {
      project: TEST_REPO.project,
      name: TEST_REPO.name,
      url: null,
    };
    try {
      await db.createRepo(testRepo);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
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
    // remove password as it will have been hashed
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers).to.deep.include(TEST_USER_CLEAN);
  });

  it('should be able to find a user', async function () {
    const user = await db.findUser(TEST_USER.username);
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    // eslint-disable-next-line no-unused-vars
    const { password: _2, _id: _3, ...DB_USER_CLEAN } = user;

    expect(DB_USER_CLEAN).to.eql(TEST_USER_CLEAN);
  });

  it('should be able to filter getUsers', async function () {
    // uppercase the filter value to confirm db client is lowercasing inputs
    const users = await db.getUsers({ username: TEST_USER.username.toUpperCase() });
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers[0]).to.eql(TEST_USER_CLEAN);

    const users2 = await db.getUsers({ email: TEST_USER.email.toUpperCase() });
    const cleanUsers2 = cleanResponseData(TEST_USER_CLEAN, users2);
    expect(cleanUsers2[0]).to.eql(TEST_USER_CLEAN);
  });

  it('should be able to delete a user', async function () {
    await db.deleteUser(TEST_USER.username);
    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(TEST_USER, users);
    expect(cleanUsers).to.not.deep.include(TEST_USER);
  });

  it('should be able to update a user', async function () {
    await db.createUser(
      TEST_USER.username,
      TEST_USER.password,
      TEST_USER.email,
      TEST_USER.gitAccount,
      TEST_USER.admin,
    );

    // has less properties to prove that records are merged
    const updateToApply = {
      username: TEST_USER.username,
      gitAccount: 'updatedGitAccount',
      admin: false,
    };

    const updatedUser = {
      // remove password as it will have been hashed
      username: TEST_USER.username,
      email: TEST_USER.email,
      gitAccount: 'updatedGitAccount',
      admin: false,
    };
    await db.updateUser(updateToApply);

    const users = await db.getUsers();
    const cleanUsers = cleanResponseData(updatedUser, users);
    expect(cleanUsers).to.deep.include(updatedUser);
    await db.deleteUser(TEST_USER.username);
  });

  it('should be able to create a user via updateUser', async function () {
    await db.updateUser(TEST_USER);

    const users = await db.getUsers();
    // remove password as it will have been hashed
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...TEST_USER_CLEAN } = TEST_USER;
    const cleanUsers = cleanResponseData(TEST_USER_CLEAN, users);
    expect(cleanUsers).to.deep.include(TEST_USER_CLEAN);
    // leave user in place for next test(s)
  });

  it('should throw an error when authorising a user to push on non-existent repo', async function () {
    let threwError = false;
    try {
      // uppercase the filter value to confirm db client is lowercasing inputs
      await db.addUserCanPush(TEST_NONEXISTENT_REPO._id, TEST_USER.username);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should be able to authorise a user to push and confirm that they can', async function () {
    // first create the repo and check that user is not allowed to push
    await db.createRepo(TEST_REPO);

    let allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).to.be.false;

    const repo = await db.getRepoByUrl(TEST_REPO.url);

    // uppercase the filter value to confirm db client is lowercasing inputs
    await db.addUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // repeat, should not throw an error if already set
    await db.addUserCanPush(repo._id, TEST_USER.username.toUpperCase());

    // confirm the setting exists
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
    expect(allowed).to.be.true;

    // confirm that casing doesn't matter
    allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username.toUpperCase());
    expect(allowed).to.be.true;
  });

  it('should throw an error when de-authorising a user to push on non-existent repo', async function () {
    let threwError = false;
    try {
      await db.removeUserCanPush(TEST_NONEXISTENT_REPO._id, TEST_USER.username);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it("should be able to de-authorise a user to push and confirm that they can't", async function () {
    let threwError = false;
    try {
      // repo should already exist with user able to push after previous test
      let allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
      expect(allowed).to.be.true;

      const repo = await db.getRepoByUrl(TEST_REPO.url);

      // uppercase the filter value to confirm db client is lowercasing inputs
      await db.removeUserCanPush(repo._id, TEST_USER.username.toUpperCase());

      // repeat, should not throw an error if already unset
      await db.removeUserCanPush(repo._id, TEST_USER.username.toUpperCase());

      // confirm the setting exists
      allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username);
      expect(allowed).to.be.false;

      // confirm that casing doesn't matter
      allowed = await db.isUserPushAllowed(TEST_REPO.url, TEST_USER.username.toUpperCase());
      expect(allowed).to.be.false;
    } catch (e) {
      console.error('Error thrown at: ' + e.stack, e);
      threwError = true;
    }
    expect(threwError).to.be.false;
  });

  it('should throw an error when authorising a user to authorise on non-existent repo', async function () {
    let threwError = false;
    try {
      await db.addUserCanAuthorise(TEST_NONEXISTENT_REPO._id, TEST_USER.username);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should throw an error when de-authorising a user to push on non-existent repo', async function () {
    let threwError = false;
    try {
      // uppercase the filter value to confirm db client is lowercasing inputs
      await db.removeUserCanAuthorise(TEST_NONEXISTENT_REPO._id, TEST_USER.username);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should NOT throw an error when checking whether a user can push on non-existent repo', async function () {
    const allowed = await db.isUserPushAllowed(TEST_NONEXISTENT_REPO.url, TEST_USER.username);
    expect(allowed).to.be.false;
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

  it('should be able to authorise a push', async function () {
    // first create the push
    await db.writeAudit(TEST_PUSH);
    let threwError = false;
    try {
      const msg = await db.authorise(TEST_PUSH.id);
      expect(msg).to.have.property('message');
    } catch (e) {
      console.error('Error: ', e);
      threwError = true;
    }
    expect(threwError).to.be.false;
    // clean up
    await db.deletePush(TEST_PUSH.id);
  });

  it('should throw an error when authorising a non-existent a push', async function () {
    let threwError = false;
    try {
      await db.authorise(TEST_PUSH.id);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should be able to reject a push', async function () {
    // first create the push
    await db.writeAudit(TEST_PUSH);
    let threwError = false;
    try {
      const msg = await db.reject(TEST_PUSH.id);
      expect(msg).to.have.property('message');
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.false;
    // clean up
    await db.deletePush(TEST_PUSH.id);
  });

  it('should throw an error when rejecting a non-existent a push', async function () {
    let threwError = false;
    try {
      await db.reject(TEST_PUSH.id);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should be able to cancel a push', async function () {
    // first create the push
    await db.writeAudit(TEST_PUSH);
    let threwError = false;
    try {
      const msg = await db.cancel(TEST_PUSH.id);
      expect(msg).to.have.property('message');
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.false;
    // clean up
    await db.deletePush(TEST_PUSH.id);
  });

  it('should throw an error when cancelling a non-existent a push', async function () {
    let threwError = false;
    try {
      await db.cancel(TEST_PUSH.id);
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.true;
  });

  it('should be able to check if a user can cancel push', async function () {
    let threwError = false;
    try {
      const repo = await db.getRepoByUrl(TEST_REPO.url);

      // push does not exist yet, should return false
      let allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;

      // create the push - user should already exist and not authorised to push
      await db.writeAudit(TEST_PUSH);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;

      // authorise user and recheck
      await db.addUserCanPush(repo._id, TEST_USER.username);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.true;

      // deauthorise user and recheck
      await db.removeUserCanPush(repo._id, TEST_USER.username);
      allowed = await db.canUserCancelPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;
    } catch (e) {
      console.error(e);
      threwError = true;
    }
    expect(threwError).to.be.false;
    // clean up
    await db.deletePush(TEST_PUSH.id);
  });

  it('should be able to check if a user can approve/reject push', async function () {
    let threwError = false;
    try {
      // push does not exist yet, should return false
      let allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;

      // create the push - user should already exist and not authorised to push
      await db.writeAudit(TEST_PUSH);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;

      const repo = await db.getRepoByUrl(TEST_REPO.url);

      // authorise user and recheck
      await db.addUserCanAuthorise(repo._id, TEST_USER.username);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.true;

      // deauthorise user and recheck
      await db.removeUserCanAuthorise(repo._id, TEST_USER.username);
      allowed = await db.canUserApproveRejectPush(TEST_PUSH.id, TEST_USER.username);
      expect(allowed).to.be.false;
    } catch (e) {
      threwError = true;
    }
    expect(threwError).to.be.false;

    // clean up
    await db.deletePush(TEST_PUSH.id);
  });

  after(async function () {
    // _id is autogenerated by the DB so we need to retrieve it before we can use it
    const repo = await db.getRepoByUrl(TEST_REPO.url);
    await db.deleteRepo(repo._id, true);
    await db.deleteUser(TEST_USER.username);
    await db.deletePush(TEST_PUSH.id);
  });
});
