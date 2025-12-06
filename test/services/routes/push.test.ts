import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import pushRouter from '../../../src/service/routes/push';
import * as db from '../../../src/db';

describe('Push API', () => {
  let app: Express;

  const mockPush = {
    id: 'push-id-123',
    type: 'push',
    url: 'https://github.com/test/repo.git',
    userEmail: 'committer@example.com',
    user: 'testcommitter',
    cancelled: false,
    rejected: false,
    authorised: false,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createApp = (username: string | undefined) => {
    const app = express();
    app.use(express.json());
    // app.use(express.urlencoded({ extended: true }));

    if (username) {
      app.use((req, res, next) => {
        req.user = { username };
        next();
      });
    }

    app.use('/push', pushRouter);
    return app;
  };

  describe('POST /:id/reject', () => {
    it('should return 401 if user is not logged in', async () => {
      const app = createApp(undefined);
      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'test' } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'not logged in' });
    });

    it('should return 400 if rejection reason is missing', async () => {
      app = createApp('testuser');

      const res = await request(app).post('/push/test-push-id-123/reject').send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Rejection reason is required' });
    });

    it('should return 400 if rejection reason is empty string', async () => {
      app = createApp('testuser');

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: '' } });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Rejection reason is required' });
    });

    it('should return 400 if rejection reason is only whitespace', async () => {
      app = createApp('testuser');

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: '    ' } });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Rejection reason is required' });
    });

    it('should return 404 if push does not exist', async () => {
      app = createApp('testuser');
      // dbStub.getPush.resolves(null);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Push request not found' });
    });

    it('should return 400 if push has not userEmail', async () => {
      app = createApp('testuser');

      const pushWithoutEmail = { ...mockPush, userEmail: null };
      vi.spyOn(db, 'getPush').mockResolvedValue(pushWithoutEmail as any);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Push request has no user email' });
    });

    it('should return 401 if no registered registered user', async () => {
      app = createApp('testuser');

      vi.spyOn(db, 'getPush').mockResolvedValue(mockPush as any);
      vi.spyOn(db, 'getUsers').mockResolvedValue([] as any);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        message:
          "There was no registered user with the committer's email address: committer@example.com",
      });
    });

    it('should return 401 if user tries to reject their own push', async () => {
      app = createApp('testcommitter');

      vi.spyOn(db, 'getPush').mockResolvedValue(mockPush as any);
      vi.spyOn(db, 'getUsers').mockResolvedValue([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ] as any);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Cannot reject your own changes' });
    });

    it('should allow admin to reject their own push', async () => {
      app = createApp('adminuser');

      vi.spyOn(db, 'getPush').mockResolvedValue({
        ...mockPush,
        userEmail: 'admin@example.com',
      } as any);

      vi.spyOn(db, 'getUsers')
        .mockResolvedValueOnce([
          {
            username: 'adminuser',
            email: 'admin@example.com',
            admin: true,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            username: 'adminuser',
            email: 'admin@example.com',
            admin: true,
          },
        ] as any);

      vi.spyOn(db, 'canUserApproveRejectPush').mockResolvedValue(true);
      const reject = vi.spyOn(db, 'reject').mockResolvedValue({ message: 'reject test-push-123' });

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Admin rejection' } });

      expect(res.status).toBe(200);
      expect(reject).toHaveBeenCalledOnce();
    });

    it('should return 401 if user is not authorised to reject', async () => {
      app = createApp('unauthorizeduser');

      vi.spyOn(db, 'getPush').mockResolvedValue(mockPush as any);
      vi.spyOn(db, 'getUsers').mockResolvedValue([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ] as any);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'User is not authorised to reject changes' });
    });

    it('should return 401 if reviewer has no email address', async () => {
      app = createApp('reviewer');

      vi.spyOn(db, 'getPush').mockResolvedValue(mockPush as any);
      vi.spyOn(db, 'getUsers')
        .mockResolvedValueOnce([
          {
            username: 'testcommitter',
            email: 'committer@example.com',
            admin: false,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            username: 'reviewer',
            admin: false,
          },
        ] as any);
      vi.spyOn(db, 'canUserApproveRejectPush').mockResolvedValue(true);

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        message: 'There was no registered email address for the reviewer: reviewer',
      });
    });

    it('should successfully reject a push with a valid reason', async () => {
      app = createApp('reviewer');
      vi.spyOn(db, 'getPush').mockResolvedValue(mockPush as any);
      vi.spyOn(db, 'getUsers')
        .mockResolvedValueOnce([
          {
            username: 'testcommitter',
            email: 'committer@example.com',
            admin: false,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            username: 'reviewer',
            email: 'reviewer@example.com',
          },
        ] as any);

      vi.spyOn(db, 'canUserApproveRejectPush').mockResolvedValue(true);
      const reject = vi.spyOn(db, 'reject').mockResolvedValue({ message: 'reject test-push-123' });

      const res = await request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'reject test-push-123' });
      expect(reject).toHaveBeenCalledOnce();
    });
  });
});
