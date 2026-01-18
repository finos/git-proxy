import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as db from '../src/db';
import { Service } from '../src/service';
import { Proxy } from '../src/proxy';
import { Express } from 'express';
import { EMPTY_COMMIT_HASH } from '../src/proxy/processors/constants';

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
  id: `${EMPTY_COMMIT_HASH}__1744380874110`,
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
    '\n\n\nGitProxy has received your push:\n\nhttp://localhost:8080/requests/${EMPTY_COMMIT_HASH}__1744380874110\n\n\n',
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

  describe('GET /api/v1/push', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
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

    it('should fetch pushes with query parameters', async () => {
      const timestamp = Date.now();
      const pushWithRejected = {
        ...TEST_PUSH,
        _id: `${EMPTY_COMMIT_HASH}__${timestamp}`,
        rejected: true,
        id: `${EMPTY_COMMIT_HASH}__${timestamp}`,
      };
      await db.writeAudit(TEST_PUSH as any);
      await db.writeAudit(pushWithRejected as any);

      await loginAsApprover();
      const res = await request(app).get('/api/v1/push?rejected=true').set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const rejectedPushes = res.body.filter((p: any) => p.rejected === true);
      expect(rejectedPushes.length).toBeGreaterThan(0);

      await db.deletePush(pushWithRejected.id);
    });

    it('should handle query parameters with false boolean values', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();

      const res = await request(app).get('/api/v1/push?canceled=false').set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle multiple query parameters', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();

      const res = await request(app)
        .get('/api/v1/push?canceled=false&rejected=false&authorised=false')
        .set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should ignore limit and skip query parameters in filtering', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();

      const res = await request(app).get('/api/v1/push?limit=10&skip=0').set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle empty query keys', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();

      const res = await request(app).get('/api/v1/push?=test').set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return empty array when no pushes match query', async () => {
      await loginAsApprover();

      const res = await request(app)
        .get('/api/v1/push?canceled=true&rejected=true')
        .set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/push/:id', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
    });

    it('should get 404 for unknown push', async () => {
      await loginAsApprover();
      const commitId = `${EMPTY_COMMIT_HASH}__79b4d8953cbc324bcc1eb53d6412ff89666c241f`;
      const res = await request(app).get(`/api/v1/push/${commitId}`).set('Cookie', `${cookie}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('not found');
    });

    it('should get a specific push by id', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();

      const res = await request(app).get(`/api/v1/push/${TEST_PUSH.id}`).set('Cookie', `${cookie}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_PUSH.id);
      expect(res.body).toEqual(TEST_PUSH);
    });
  });

  describe('POST /api/v1/push/:id/authorise', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
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

    it('should NOT allow authorization without being logged in', async () => {
      await db.writeAudit(TEST_PUSH as any);

      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/authorise`)
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

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not logged in');
    });

    it('should NOT allow an authorizer to approve if attestation is incomplete', async () => {
      await db.writeAudit(TEST_PUSH as any);
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

    it('should NOT allow authorization if push is not found', async () => {
      await loginAsApprover();
      const fakeId = `${EMPTY_COMMIT_HASH}__9999999999999`;

      const res = await request(app)
        .post(`/api/v1/push/${fakeId}/authorise`)
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
      expect(res.body.message).toBe('Push request not found');
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

    it('should NOT allow an authorizer to approve their own push', async () => {
      // make the approver the committer
      const testPush = { ...TEST_PUSH, user: TEST_USERNAME_1, userEmail: TEST_EMAIL_1 };
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

    it('should return 404 if reviewer has no email address', async () => {
      // Create a test user without an email address
      const testUsername = 'no-email-user';
      const testPassword = 'password123';

      await db.writeAudit(TEST_PUSH as any);

      await db.createUser(testUsername, testPassword, 'test@test.com', testUsername, false);
      await db.updateUser({ username: testUsername, email: '' });
      await db.addUserCanAuthorise(testRepo._id, testUsername);

      await login(testUsername, testPassword);

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

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        `There was no registered email address for the reviewer: ${testUsername}`,
      );

      // Cleanup
      await logout();
      await db.deleteUser(testUsername);
    });

    it('should return 403 if user is not authorized to approve pushes on the project', async () => {
      // Create a test user who is NOT authorized for this repo
      const testUsername = 'unauthorized-user';
      const testPassword = 'password123';
      const testEmail = 'unauthorized@test.com';

      await db.writeAudit(TEST_PUSH as any);

      // Create user but DON'T add them as an authorizer for the repo
      await db.createUser(testUsername, testPassword, testEmail, testUsername, false);

      await login(testUsername, testPassword);

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
      expect(res.body.message).toBe(
        `User ${testUsername} not authorised to approve pushes on this project`,
      );

      // Cleanup
      await logout();
      await db.deleteUser(testUsername);
    });
  });

  describe('POST /api/v1/push/:id/reject', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
    });

    it('should allow an authorizer to reject a push', async () => {
      await db.writeAudit(TEST_PUSH as any);
      await loginAsApprover();
      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);
      expect(res.status).toBe(200);
    });

    it('should NOT allow rejection without being logged in', async () => {
      await db.writeAudit(TEST_PUSH as any);

      const res = await request(app).post(`/api/v1/push/${TEST_PUSH.id}/reject`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not logged in');
    });

    it('should NOT allow rejection if push is not found', async () => {
      await loginAsApprover();
      const fakeId = `${EMPTY_COMMIT_HASH}__9999999999999`;

      const res = await request(app)
        .post(`/api/v1/push/${fakeId}/reject`)
        .set('Cookie', `${cookie}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Push request not found');
    });

    it('should NOT allow rejection if push has no userEmail', async () => {
      const testPush = { ...TEST_PUSH, userEmail: null, id: `${EMPTY_COMMIT_HASH}__1744380874112` };
      await db.writeAudit(testPush as any);
      await loginAsApprover();

      const res = await request(app)
        .post(`/api/v1/push/${testPush.id}/reject`)
        .set('Cookie', `${cookie}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Push request has no user email');

      await db.deletePush(testPush.id);
    });

    it('should NOT allow rejection if committer user is not found', async () => {
      const testPush = { ...TEST_PUSH, user: TEST_USERNAME_3, userEmail: TEST_EMAIL_3 };
      await db.writeAudit(testPush as any);
      await loginAsApprover();

      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "No user found with the committer's email address: push-test-3@test.com",
      );
    });

    it('should NOT allow an authorizer to reject their own push', async () => {
      const testPush = { ...TEST_PUSH, user: TEST_USERNAME_1, userEmail: TEST_EMAIL_1 };
      await db.writeAudit(testPush as any);
      await loginAsApprover();
      const res = await request(app)
        .post(`/api/v1/push/${TEST_PUSH.id}/reject`)
        .set('Cookie', `${cookie}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Cannot reject your own changes');
    });

    it('should NOT allow a non-authorizer to reject a push', async () => {
      const pushWithOtherUser = { ...TEST_PUSH, user: TEST_USERNAME_1, userEmail: TEST_EMAIL_1 };
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
  });

  describe('POST /api/v1/push/:id/cancel', () => {
    afterEach(async () => {
      await db.deletePush(TEST_PUSH.id);
      if (cookie) await logout();
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

    it('should NOT allow cancellation without being logged in', async () => {
      await db.writeAudit(TEST_PUSH as any);

      const res = await request(app).post(`/api/v1/push/${TEST_PUSH.id}/cancel`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not logged in');
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
  });

  afterAll(async () => {
    if (cookie) {
      const res = await request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
      expect(res.status).toBe(200);
    }

    await Service.httpServer.close();
    await db.deleteRepo(testRepo._id);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);
    await db.deletePush(TEST_PUSH.id);
  });
});
