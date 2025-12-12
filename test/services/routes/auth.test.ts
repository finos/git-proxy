import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import authRoutes from '../../../src/service/routes/auth';
import * as db from '../../../src/db';

const newApp = (username?: string): Express => {
  const app = express();
  app.use(express.json());

  if (username) {
    app.use((req, _res, next) => {
      req.user = { username };
      next();
    });
  }

  app.use('/auth', authRoutes.router);
  return app;
};

describe('Auth API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /gitAccount', () => {
    beforeEach(() => {
      vi.spyOn(db, 'findUser').mockImplementation((username: string) => {
        if (username === 'alice') {
          return Promise.resolve({
            username: 'alice',
            displayName: 'Alice Munro',
            gitAccount: 'ORIGINAL_GIT_ACCOUNT',
            email: 'alice@example.com',
            admin: true,
            password: '',
            title: '',
          });
        } else if (username === 'bob') {
          return Promise.resolve({
            username: 'bob',
            displayName: 'Bob Woodward',
            gitAccount: 'WOODY_GIT_ACCOUNT',
            email: 'bob@example.com',
            admin: false,
            password: '',
            title: '',
          });
        }
        return Promise.resolve(null);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return 401 Unauthorized if authenticated user not in request', async () => {
      const res = await request(newApp()).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: '',
      });

      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request if username is missing', async () => {
      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is undefined', async () => {
      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        username: undefined,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is null', async () => {
      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        username: null,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is an empty string', async () => {
      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        username: '',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 403 Forbidden if user is not an admin', async () => {
      const res = await request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(403);
    });

    it('should return 200 OK if user is an admin and updates git account for authenticated user', async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(200);
      expect(updateUserSpy).toHaveBeenCalledOnce();
      expect(updateUserSpy).toHaveBeenCalledWith({
        username: 'alice',
        displayName: 'Alice Munro',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
        email: 'alice@example.com',
        admin: true,
        password: '',
        title: '',
      });
    });

    it("should prevent non-admin users from changing a different user's gitAccount", async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'phil',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(403);
      expect(updateUserSpy).not.toHaveBeenCalled();
    });

    it("should allow admin users to change a different user's gitAccount", async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('alice')).post('/auth/gitAccount').send({
        username: 'bob',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(200);
      expect(updateUserSpy).toHaveBeenCalledOnce();
      expect(updateUserSpy).toHaveBeenCalledWith({
        username: 'bob',
        displayName: 'Bob Woodward',
        email: 'bob@example.com',
        admin: false,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
        password: '',
        title: '',
      });
    });

    it('should allow non-admin users to update their own gitAccount', async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'bob',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(200);
      expect(updateUserSpy).toHaveBeenCalledOnce();
      expect(updateUserSpy).toHaveBeenCalledWith({
        username: 'bob',
        displayName: 'Bob Woodward',
        email: 'bob@example.com',
        admin: false,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
        password: '',
        title: '',
      });
    });
  });

  describe('loginSuccessHandler', () => {
    it('should log in user and return public user data', async () => {
      const user = {
        username: 'bob',
        password: 'secret',
        email: 'bob@example.com',
        displayName: 'Bob',
        admin: false,
        gitAccount: '',
        title: '',
      };

      const sendSpy = vi.fn();
      const res = {
        send: sendSpy,
      };

      await authRoutes.loginSuccessHandler()(
        { user } as unknown as Request,
        res as unknown as Response,
      );

      expect(sendSpy).toHaveBeenCalledOnce();
      expect(sendSpy).toHaveBeenCalledWith({
        message: 'success',
        user: {
          admin: false,
          displayName: 'Bob',
          email: 'bob@example.com',
          gitAccount: '',
          title: '',
          username: 'bob',
        },
      });
    });
  });

  describe('GET /me', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const res = await request(newApp()).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 200 OK and serialize public data representation of current logged in user', async () => {
      vi.spyOn(db, 'findUser').mockResolvedValue({
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
        admin: false,
        gitAccount: '',
        title: '',
      });

      const res = await request(newApp('alice')).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      });
    });
  });

  describe('GET /profile', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const res = await request(newApp()).get('/auth/profile');

      expect(res.status).toBe(401);
    });

    it('should return 200 OK and serialize public data representation of current authenticated user', async () => {
      vi.spyOn(db, 'findUser').mockResolvedValue({
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
        admin: false,
        gitAccount: '',
        title: '',
      });

      const res = await request(newApp('alice')).get('/auth/profile');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      });
    });
  });
});
