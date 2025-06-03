const chai = require('chai');
const processor = require('../src/proxy/processors/push-action/checkUserPushPermission');
const { Action } = require('../src/proxy/actions/Action');
const { expect } = chai;
const db = require('../src/db');
chai.should();

const TEST_ORG = 'finos';
const TEST_REPO = 'test';
const TEST_URL = 'https://github.com/finos/user-push-perms-test.git';
const TEST_USERNAME_1 = 'push-perms-test';
const TEST_EMAIL_1 = 'push-perms-test@test.com';
const TEST_USERNAME_2 = 'push-perms-test-2';
const TEST_EMAIL_2 = 'push-perms-test-2@test.com';
const TEST_EMAIL_3 = 'push-perms-test-3@test.com';

describe('CheckUserPushPermissions...', async () => {
  before(async function () {
    await db.deleteRepo(TEST_REPO);
    await db.deleteUser(TEST_USERNAME_1);

    await db.createRepo({
      project: TEST_ORG,
      name: TEST_REPO,
      url: TEST_URL,
    });
    await db.createUser(TEST_USERNAME_1, 'abc', TEST_EMAIL_1, TEST_USERNAME_1, false);
    await db.addUserCanPush(TEST_REPO, TEST_USERNAME_1);

    await db.createUser(TEST_USERNAME_2, 'abc', TEST_EMAIL_2, TEST_USERNAME_2, false);
  });

  after(async function () {
    await db.deleteRepo(TEST_REPO);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);
  });

  it('A committer that is approved should be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_ORG + '/' + TEST_REPO);
    action.userEmail = TEST_EMAIL_1;
    const { error } = await processor.exec(null, action);
    expect(error).to.be.false;
  });

  it('A committer that is NOT approved should NOT be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_ORG + '/' + TEST_REPO);
    action.userEmail = TEST_EMAIL_2;
    const { error, errorMessage } = await processor.exec(null, action);
    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });

  it('An unknown committer should NOT be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_ORG + '/' + TEST_REPO);
    action.userEmail = TEST_EMAIL_3;
    const { error, errorMessage } = await processor.exec(null, action);
    expect(error).to.be.true;
    expect(errorMessage).to.contains('Your push has been blocked');
  });
});
