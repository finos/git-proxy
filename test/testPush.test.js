// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

// dummy repo
const TEST_ORG = 'finos';
const TEST_REPO = 'test-push';
const TEST_URL = 'https://github.com/finos/test-push.git';
// approver user
const TEST_USERNAME_1 = 'push-test';
const TEST_EMAIL_1 = 'push-test@test.com';
const TEST_PASSWORD_1 = 'test1234';
// committer user
const TEST_USERNAME_2 = 'push-test-2';
const TEST_EMAIL_2 = 'push-test-2@test.com';
const TEST_PASSWORD_2 = 'test5678';
// unknown user
const TEST_USERNAME_3 = 'push-test-3';
const TEST_EMAIL_3 = 'push-test-3@test.com';

const TEST_PUSH = {
  steps: [],
  error: false,
  blocked: false,
  allowPush: false,
  authorised: false,
  canceled: false,
  rejected: false,
  autoApproved: false,
  autoRejected: false,
  commitData: [],
  id: '0000000000000000000000000000000000000000__1744380874110',
  type: 'push',
  method: 'get',
  timestamp: 1744380903338,
  project: TEST_ORG,
  repoName: TEST_REPO + '.git',
  url: TEST_REPO,
  repo: TEST_ORG + '/' + TEST_REPO + '.git',
  user: TEST_USERNAME_2,
  userEmail: TEST_EMAIL_2,
  lastStep: null,
  blockedMessage:
    '\n\n\nGitProxy has received your push:\n\nhttp://localhost:8080/requests/0000000000000000000000000000000000000000__1744380874110\n\n\n',
  _id: 'GIMEz8tU2KScZiTz',
  attestation: null,
};

describe('auth', async () => {
  let app;
  let cookie;

  const setCookie = function (res) {
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        const value = x.split(';')[0];
        cookie = value;
      }
    });
  };

  const login = async function (username, password) {
    console.log(`logging in as ${username}...`);
    const res = await chai.request(app).post('/api/auth/login').send({
      username: username,
      password: password,
    });
    res.should.have.status(200);
    expect(res).to.have.cookie('connect.sid');
    setCookie(res);
  };

  const loginAsApprover = () => login(TEST_USERNAME_1, TEST_PASSWORD_1);
  const loginAsCommitter = () => login(TEST_USERNAME_2, TEST_PASSWORD_2);
  const loginAsAdmin = () => login('admin', 'admin');

  const logout = async function () {
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);
    cookie = null;
  };

  before(async function () {
    app = await service.start();
    await loginAsAdmin();

    // set up a repo, user and push to test against
    await db.deleteRepo(TEST_REPO);
    await db.deleteUser(TEST_USERNAME_1);
    await db.createRepo({
      project: TEST_ORG,
      name: TEST_REPO,
      url: TEST_URL,
    });

    // Create a new user for the approver
    console.log('creating approver');
    await db.createUser(TEST_USERNAME_1, TEST_PASSWORD_1, TEST_EMAIL_1, TEST_USERNAME_1, false);
    await db.addUserCanAuthorise(TEST_REPO, TEST_USERNAME_1);

    // create a new user for the committer
    console.log('creating committer');
    await db.createUser(TEST_USERNAME_2, TEST_PASSWORD_2, TEST_EMAIL_2, TEST_USERNAME_2, false);
    await db.addUserCanPush(TEST_REPO, TEST_USERNAME_2);

    // logout of admin account
    await logout();
  });

  describe('test push API', async function () {
    afterEach(async function () {
      await db.deletePush(TEST_PUSH.id);
      await logout();
    });

    it('should get 404 for unknown push', async function () {
      await loginAsApprover();

      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
      const res = await chai
        .request(app)
        .get(`/api/v1/push/${commitId}`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(404);
    });

    it('should allow an authorizer to approve a push', async function () {
      await db.writeAudit(TEST_PUSH);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/x-www-form-urlencoded')
        .send({
          params: {
            attestation: [
              {
                label: 'I am happy for this to be pushed to the upstream repository',
                tooltip: {
                  text: 'Are you happy for this contribution to be pushed upstream?',
                  links: [],
                },
                checked: true,
              },
            ],
          },
        });
      res.should.have.status(200);
    });

    it('should NOT allow an authorizer to approve if attestation is incomplete', async function () {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH };
      testPush.user = TEST_USERNAME_1;
      testPush.userEmail = TEST_EMAIL_1;
      await db.writeAudit(testPush);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/x-www-form-urlencoded')
        .send({
          params: {
            attestation: [
              {
                label: 'I am happy for this to be pushed to the upstream repository',
                tooltip: {
                  text: 'Are you happy for this contribution to be pushed upstream?',
                  links: [],
                },
                checked: false,
              },
            ],
          },
        });
      res.should.have.status(401);
    });

    it('should NOT allow an authorizer to approve if committer is unknown', async function () {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH };
      testPush.user = TEST_USERNAME_3;
      testPush.userEmail = TEST_EMAIL_3;
      await db.writeAudit(testPush);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/x-www-form-urlencoded')
        .send({
          params: {
            attestation: [
              {
                label: 'I am happy for this to be pushed to the upstream repository',
                tooltip: {
                  text: 'Are you happy for this contribution to be pushed upstream?',
                  links: [],
                },
                checked: true,
              },
            ],
          },
        });
      res.should.have.status(401);
    });

    it('should NOT allow an authorizer to approve their own push', async function () {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH };
      testPush.user = TEST_USERNAME_1;
      testPush.userEmail = TEST_EMAIL_1;
      await db.writeAudit(testPush);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/x-www-form-urlencoded')
        .send({
          params: {
            attestation: [
              {
                label: 'I am happy for this to be pushed to the upstream repository',
                tooltip: {
                  text: 'Are you happy for this contribution to be pushed upstream?',
                  links: [],
                },
                checked: true,
              },
            ],
          },
        });
      res.should.have.status(401);
    });

    it('should NOT allow a non-authorizer to approve a push', async function () {
      await db.writeAudit(TEST_PUSH);
      await loginAsCommitter();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/x-www-form-urlencoded')
        .send({
          params: {
            attestation: [
              {
                label: 'I am happy for this to be pushed to the upstream repository',
                tooltip: {
                  text: 'Are you happy for this contribution to be pushed upstream?',
                  links: [],
                },
                checked: true,
              },
            ],
          },
        });
      res.should.have.status(401);
    });

    it('should allow an authorizer to reject a push', async function () {
      await db.writeAudit(TEST_PUSH);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should NOT allow an authorizer to reject their own push', async function () {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH };
      testPush.user = TEST_USERNAME_1;
      testPush.userEmail = TEST_EMAIL_1;
      await db.writeAudit(testPush);
      await loginAsApprover();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(401);
    });

    it('should NOT allow a non-authorizer to reject a push', async function () {
      await db.writeAudit(TEST_PUSH);
      await loginAsCommitter();
      const res = await chai
        .request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(401);
    });
  });

  after(async function () {
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);

    await service.httpServer.close();

    await db.deleteRepo(TEST_REPO);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);
    await db.deletePush(TEST_PUSH.id);
  });
});
