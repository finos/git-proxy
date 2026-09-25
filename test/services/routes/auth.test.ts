/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import authRoutes from '../../../src/service/routes/auth';
import * as db from '../../../src/db';
import * as config from '../../../src/config';
import bcryptjs from 'bcryptjs';

vi.mock('../../../src/db', () => ({
  findUser: vi.fn(),
  updateUser: vi.fn(),
  setUserScmIdentity: vi.fn(),
  createUser: vi.fn(),
}));

const newApp = (username?: string, options?: { mustChangePassword?: boolean }): Express => {
  const app = express();
  app.use(express.json());

  if (username) {
    app.use((req, _res, next) => {
      req.user = { username, mustChangePassword: options?.mustChangePassword };
      next();
    });
  }

  app.use('/auth', authRoutes.router);
  return app;
};

describe('Auth API', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('POST /scm-identity', () => {
    beforeEach(() => {
      vi.mocked(db.findUser).mockImplementation((username: string) => {
        if (username === 'alice') {
          return Promise.resolve({
            username: 'alice',
            displayName: 'Alice Munro',
            scmIdentities: { github: 'alice-github' },
            email: 'alice@example.com',
            admin: true,
            password: '',
            title: '',
          } as any);
        } else if (username === 'bob') {
          return Promise.resolve({
            username: 'bob',
            displayName: 'Bob Woodward',
            scmIdentities: { github: 'bob-github' },
            email: 'bob@example.com',
            admin: false,
            password: '',
            title: '',
          } as any);
        }
        return Promise.resolve(null);
      });
    });

    it('should return 401 if user is not logged in', async () => {
      const res = await request(newApp()).post('/auth/scm-identity').send({
        provider: 'github',
        login: 'user-handle',
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Not logged in' });
    });

    it('should return 400 if provider is missing', async () => {
      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        login: 'user-handle',
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Missing provider. SCM identity not updated' });
    });

    it('should return 400 if provider is unknown', async () => {
      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        provider: 'unknownprovider',
        login: 'user-handle',
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Unknown SCM provider 'unknownprovider'. SCM identity not updated",
      });
    });

    it('should allow user to link their own SCM identity', async () => {
      const setUserScmIdentitySpy = vi.mocked(db.setUserScmIdentity).mockResolvedValue();

      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        provider: 'github',
        login: 'alice-new-handle',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'SCM identity updated successfully' });
      expect(setUserScmIdentitySpy).toHaveBeenCalledOnce();
      expect(setUserScmIdentitySpy).toHaveBeenCalledWith('alice', 'github', 'alice-new-handle');
    });

    it('should prevent non-admin from linking different user', async () => {
      const setUserScmIdentitySpy = vi.mocked(db.setUserScmIdentity).mockResolvedValue();

      const res = await request(newApp('bob')).post('/auth/scm-identity').send({
        username: 'alice',
        provider: 'github',
        login: 'new-handle',
      });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Must be an admin to update a different account' });
      expect(setUserScmIdentitySpy).not.toHaveBeenCalled();
    });

    it('should allow admin to link different user', async () => {
      const setUserScmIdentitySpy = vi.mocked(db.setUserScmIdentity).mockResolvedValue();

      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        username: 'bob',
        provider: 'github',
        login: 'bob-new-handle',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'SCM identity updated successfully' });
      expect(setUserScmIdentitySpy).toHaveBeenCalledOnce();
      expect(setUserScmIdentitySpy).toHaveBeenCalledWith('bob', 'github', 'bob-new-handle');
    });

    it('should allow unlinking by passing null login', async () => {
      const setUserScmIdentitySpy = vi.mocked(db.setUserScmIdentity).mockResolvedValue();

      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        provider: 'github',
        login: null,
      });

      expect(res.status).toBe(200);
      expect(setUserScmIdentitySpy).toHaveBeenCalledWith('alice', 'github', null);
    });

    it('should return 404 if target user is not found', async () => {
      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        username: 'non-existent-user',
        provider: 'github',
        login: 'handle',
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.setUserScmIdentity).mockRejectedValue(new Error('Database error'));

      const res = await request(newApp('alice')).post('/auth/scm-identity').send({
        provider: 'github',
        login: 'handle',
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Failed to update SCM identity: Database error' });
    });
  });

  describe('POST /change-password', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return 401 if user is not logged in', async () => {
      const res = await request(newApp()).post('/auth/change-password').send({
        currentPassword: 'admin',
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid payload', async () => {
      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'admin',
        newPassword: 'short',
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 if user is not found', async () => {
      vi.spyOn(db, 'findUser').mockResolvedValue(null);

      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'admin-password',
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(404);
    });

    it('should return 401 when current password is incorrect', async () => {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('correct-password', 10);
      vi.spyOn(db, 'findUser').mockResolvedValue({
        username: 'alice',
        password: hashedPassword,
        email: 'alice@example.com',
        displayName: 'Alice Munro',
        scmIdentities: {},
        admin: true,
        title: '',
      } as any);

      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(401);
    });

    it('should reset mustChangePassword after successful password update', async () => {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin', 10);
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();
      vi.spyOn(db, 'findUser').mockResolvedValue({
        username: 'alice',
        password: hashedPassword,
        email: 'alice@example.com',
        displayName: 'Alice Munro',
        scmIdentities: {},
        admin: true,
        title: '',
      } as any);

      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'admin',
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(200);
      expect(updateUserSpy).toHaveBeenCalledWith({
        username: 'alice',
        password: expect.any(String),
        mustChangePassword: false,
      });
    });

    it('should return 400 if current password is the same as the new password', async () => {
      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'secret-password',
        newPassword: 'secret-password',
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'newPassword must be different from currentPassword' });
    });

    it('should return 400 if current password is missing (i.e: OIDC login)', async () => {
      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: undefined,
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message:
          'currentPassword and newPassword are required, and newPassword must be at least 8 characters',
      });
    });

    it('should return 500 if an error occurs', async () => {
      vi.spyOn(db, 'updateUser').mockRejectedValue(new Error('Error'));
      vi.spyOn(db, 'findUser').mockResolvedValue({
        username: 'alice',
        password: await bcryptjs.hash('secret-password', 10),
        email: 'alice@example.com',
        displayName: 'Alice Munro',
        scmIdentities: {},
        admin: true,
        title: '',
      } as any);
      const res = await request(newApp('alice')).post('/auth/change-password').send({
        currentPassword: 'secret-password',
        newPassword: 'new-password-123',
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Failed to update password: Error' });
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
        scmIdentities: { github: 'bob-handle' },
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
          scmIdentities: { github: 'bob-handle' },
          title: '',
          username: 'bob',
        },
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
        scmIdentities: { github: 'alice-handle' },
        title: '',
      } as any);

      const res = await request(newApp('alice')).get('/auth/profile');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        scmIdentities: { github: 'alice-handle' },
        admin: false,
      });
    });

    it('should return 404 Not Found if user is not found', async () => {
      vi.spyOn(db, 'findUser').mockResolvedValue(null);

      const res = await request(newApp('non-existent-user')).get('/auth/profile');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });
  });

  describe('GET /', () => {
    it('should return 200 OK and the auth endpoints', async () => {
      const res = await request(newApp()).get('/auth');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        login: {
          action: 'post',
          uri: '/api/auth/login',
        },
        profile: {
          action: 'get',
          uri: '/api/auth/profile',
        },
        logout: {
          action: 'post',
          uri: '/api/auth/logout',
        },
      });
    });
  });

  describe('GET /config', () => {
    it('should return 200 OK and the default auth config', async () => {
      const res = await request(newApp()).get('/auth/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        usernamePasswordMethod: 'local',
        otherMethods: [],
      });
    });

    it('should return null usernamePasswordMethod if no username/password auth method is enabled', async () => {
      // Mock the getAuthMethods function to return an empty array
      vi.spyOn(config, 'getAuthMethods').mockReturnValue([]);

      const res = await request(newApp()).get('/auth/config');
      expect(res.status).toBe(200);
      expect(res.body.usernamePasswordMethod).toBeNull();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.resetModules();
    });
  });
});
