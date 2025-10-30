import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
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

  describe('/gitAccount', () => {
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

    it('POST /gitAccount returns Unauthorized if authenticated user not in request', async () => {
      const res = await request(newApp()).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: '',
      });

      expect(res.status).toBe(401);
    });

    it('POST /gitAccount updates git account for authenticated user', async () => {
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

    it('POST /gitAccount prevents non-admin user changing a different user gitAccount', async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'phil',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(403);
      expect(updateUserSpy).not.toHaveBeenCalled();
    });

    it('POST /gitAccount lets admin user change a different users gitAccount', async () => {
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

    it('POST /gitAccount allows non-admin user to update their own gitAccount', async () => {
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
      } as any;

      await authRoutes.loginSuccessHandler()({ user } as any, res);

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

  describe('/me', () => {
    it('GET /me returns Unauthorized if authenticated user not in request', async () => {
      const res = await request(newApp()).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('GET /me serializes public data representation of current authenticated user', async () => {
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

  describe('/profile', () => {
    it('GET /profile returns Unauthorized if authenticated user not in request', async () => {
      const res = await request(newApp()).get('/auth/profile');

      expect(res.status).toBe(401);
    });

    it('GET /profile serializes public data representation of current authenticated user', async () => {
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
