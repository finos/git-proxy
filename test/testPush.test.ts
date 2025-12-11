import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as db from '../src/db';
import { Service } from '../src/service';
import { Proxy } from '../src/proxy';
import { Express } from 'express';

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
  url: TEST_URL,
  repo: TEST_ORG + '/' + TEST_REPO + '.git',
  user: TEST_USERNAME_2,
  userEmail: TEST_EMAIL_2,
  lastStep: null,
  blockedMessage:
    '\n\n\nGitProxy has received your push:\n\nhttp://localhost:8080/requests/0000000000000000000000000000000000000000__1744380874110\n\n\n',
  _id: 'GIMEz8tU2KScZiTz',
  attestation: null,
};

describe('Push API', () => {
  let app: Express;
  let cookie: string | null = null;
  let testRepo: any;

  const setCookie = (res: any) => {
    const cookies: string[] = res.headers['set-cookie'] ?? [];
    for (const x of cookies) {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    }
  };

  const login = async (username: string, password: string) => {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    setCookie(res);
  };

  const loginAsApprover = () => login(TEST_USERNAME_1, TEST_PASSWORD_1);
  const loginAsCommitter = () => login(TEST_USERNAME_2, TEST_PASSWORD_2);
  const loginAsAdmin = () => login('admin', 'admin');

  const logout = async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    expect(res.status).toBe(200);
    cookie = null;
  };

  beforeAll(async () => {
    // remove existing repo and users if any
    const oldRepo = await db.getRepoByUrl(TEST_URL);
    if (oldRepo) {
      await db.deleteRepo(oldRepo._id!);
    }
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);

    const proxy = new Proxy();
    app = await Service.start(proxy);
    await loginAsAdmin();

    // set up a repo, user and push to test against
    testRepo = await db.createRepo({
      project: TEST_ORG,
      name: TEST_REPO,
      url: TEST_URL,
    });

    // Create a new user for the approver
    await db.createUser(TEST_USERNAME_1, TEST_PASSWORD_1, TEST_EMAIL_1, TEST_USERNAME_1, false);
    await db.addUserCanAuthorise(testRepo._id, TEST_USERNAME_1);

    // create a new user for the committer
    await db.createUser(TEST_USERNAME_2, TEST_PASSWORD_2, TEST_EMAIL_2, TEST_USERNAME_2, false);
    await db.addUserCanPush(testRepo._id, TEST_USERNAME_2);

    // logout of admin account
    await logout();
  });

  afterAll(async () => {
    await db.deleteRepo(testRepo._id);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);

    vi.resetModules();
    Service.httpServer.close();
  });

  describe('test push API', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
    });

    it('should get 404 for unknown push', async () => {
      await loginAsApprover();
      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';
      const res = await request(app).get(`/api/v1/push/${commitId}`).set('Cookie', `${cookie}`);
      expect(res.status).toBe(404);
    });

    it('should allow an authorizer to approve a push', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();
      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/json') // must use JSON format to send arrays
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
      expect(res.status).toBe(200);
    });

    it('should NOT allow an authorizer to approve if attestation is incomplete', async () => {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH, user: TEST_USERNAME_1, userEmail: TEST_EMAIL_1 };
      await db.writeAudit(testPush as any);
      await loginAsApprover();
      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/json')
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
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Attestation is not complete');
    });

    it('should NOT allow an authorizer to approve if committer is unknown', async () => {
      // make the approver also the committer
      const testPush = { ...TEST_PUSH, user: TEST_USERNAME_3, userEmail: TEST_EMAIL_3 };
      await db.writeAudit(testPush as any);
      await loginAsApprover();
      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
        .set('Cookie', `${cookie}`)
        .set('content-type', 'application/json')
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
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "No user found with the committer's email address: push-test-3@test.com",
      );
    });
  });

  it('should NOT allow an authorizer to approve their own push', async () => {
    // make the approver also the committer
    const testPush = { ...TEST_PUSH };
    testPush.user = TEST_USERNAME_1;
    testPush.userEmail = TEST_EMAIL_1;
    await db.writeAudit(testPush as any);
    await loginAsApprover();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
      .set('Cookie', `${cookie}`)
      .set('Content-Type', 'application/json')
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
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot approve your own changes');
  });

  it('should NOT allow a non-authorizer to approve a push', async () => {
    await db.writeAudit(TEST_PUSH as any);
    await loginAsCommitter();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
      .set('Cookie', `${cookie}`)
      .set('Content-Type', 'application/json')
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
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot approve your own changes');
  });

  it('should allow an authorizer to reject a push', async () => {
    await db.writeAudit(TEST_PUSH as any);
    await loginAsApprover();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
      .set('Cookie', `${cookie}`);
    expect(res.status).toBe(200);
  });

  it('should NOT allow an authorizer to reject their own push', async () => {
    // make the approver also the committer
    const testPush = { ...TEST_PUSH };
    testPush.user = TEST_USERNAME_1;
    testPush.userEmail = TEST_EMAIL_1;
    await db.writeAudit(testPush as any);
    await loginAsApprover();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
      .set('Cookie', `${cookie}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cannot reject your own changes');
  });

  it('should NOT allow a non-authorizer to reject a push', async () => {
    const pushWithOtherUser = { ...TEST_PUSH };
    pushWithOtherUser.user = TEST_USERNAME_1;
    pushWithOtherUser.userEmail = TEST_EMAIL_1;

    await db.writeAudit(pushWithOtherUser as any);
    await loginAsCommitter();
    const res = await request(app)
      .post(`/api/v1/push/${pushWithOtherUser.id}/reject`)
      .set('Cookie', `${cookie}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'User push-test-2 is not authorised to reject changes on this project',
    );
  });

  it('should fetch all pushes', async () => {
    await db.writeAudit(TEST_PUSH as any);
    await loginAsApprover();
    const res = await request(app).get('/api/v1/push').set('Cookie', `${cookie}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const push = res.body.find((p: any) => p.id === TEST_PUSH.id);
    expect(push).toBeDefined();
    expect(push).toEqual(TEST_PUSH);
    expect(push.canceled).toBe(false);
  });

  it('should allow a committer to cancel a push', async () => {
    await db.writeAudit(TEST_PUSH as any);
    await loginAsCommitter();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/cancel`)
      .set('Cookie', `${cookie}`);
    expect(res.status).toBe(200);

    const pushes = await request(app).get('/api/v1/push').set('Cookie', `${cookie}`);
    const push = pushes.body.find((p: any) => p.id === TEST_PUSH.id);

    expect(push).toBeDefined();
    expect(push.canceled).toBe(true);
  });

  it('should not allow a non-committer to cancel a push (even if admin)', async () => {
    await db.writeAudit(TEST_PUSH as any);
    await loginAsAdmin();
    const res = await request(app)
      .post(`/api/v1/push/${TEST_PUSH.id}/cancel`)
      .set('Cookie', `${cookie}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'User admin not authorised to cancel push requests on this project',
    );

    const pushes = await request(app).get('/api/v1/push').set('Cookie', `${cookie}`);
    const push = pushes.body.find((p: any) => p.id === TEST_PUSH.id);

    expect(push).toBeDefined();
    expect(push.canceled).toBe(false);
  });

  afterAll(async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    expect(res.status).toBe(200);

    await Service.httpServer.close();
    await db.deleteRepo(TEST_REPO);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);
    await db.deletePush(TEST_PUSH.id);
  });
});
