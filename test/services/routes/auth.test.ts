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
import express, { Express } from 'express';
import { RegisterRoutes } from '../../../src/service/generatedRoutes';
import * as db from '../../../src/db';
import { ValidateError } from 'tsoa';

/**
 * Builds a minimal Express app with tsoa routes registered.
 * When `username` is supplied the request is pre-authenticated via middleware,
 * simulating a session-authenticated user.
 */
const newApp = (username?: string, isAdmin = false): Express => {
  const app = express();
  app.use(express.json());

  if (username) {
    app.use((req, _res, next) => {
      req.user = { username, admin: isAdmin };
      (req as any).isAuthenticated = () => true;
      next();
    });
  } else {
    app.use((_req, _res, next) => {
      (_req as any).isAuthenticated = () => false;
      next();
    });
  }

  // Generic error handler so tsoa thrown errors propagate as HTTP responses.
  RegisterRoutes(app);

  // tsoa validation errors
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err instanceof ValidateError) {
      return res.status(400).json({
        message: 'Validation failed',
        details: err.fields,
      });
    }
    next(err);
  });

  // Generic error handler so tsoa thrown errors propagate as HTTP responses.
  app.use((err: any, _req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);
    res.status(err.status ?? 500).json({ message: err.message });
  });

  return app;
};

describe('Auth API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/gitAccount', () => {
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
      const res = await request(newApp()).post('/api/auth/gitAccount').send({
        username: 'alice',
        gitAccount: '',
      });

      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request if username is missing', async () => {
      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is undefined', async () => {
      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
        username: undefined,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is null', async () => {
      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
        username: null,
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 Bad Request if username is an empty string', async () => {
      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
        username: '',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(400);
    });

    it('should return 403 Forbidden if user is not an admin', async () => {
      const res = await request(newApp('bob')).post('/api/auth/gitAccount').send({
        username: 'alice',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(403);
    });

    it('should return 404 Not Found if user is not found', async () => {
      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
        username: 'non-existent-user',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(404);
    });

    it('should return 200 OK if user is an admin and updates git account for authenticated user', async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
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

      const res = await request(newApp('bob')).post('/api/auth/gitAccount').send({
        username: 'phil',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res.status).toBe(403);
      expect(updateUserSpy).not.toHaveBeenCalled();
    });

    it("should allow admin users to change a different user's gitAccount", async () => {
      const updateUserSpy = vi.spyOn(db, 'updateUser').mockResolvedValue();

      const res = await request(newApp('alice', true)).post('/api/auth/gitAccount').send({
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

      const res = await request(newApp('bob')).post('/api/auth/gitAccount').send({
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

  describe('GET /api/auth/profile', () => {
    it('should return 401 Unauthorized if user is not logged in', async () => {
      const res = await request(newApp()).get('/api/auth/profile');

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

      const res = await request(newApp('alice')).get('/api/auth/profile');
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

    it('should return 404 Not Found if user is not found', async () => {
      vi.spyOn(db, 'findUser').mockResolvedValue(null);

      const res = await request(newApp('non-existent-user')).get('/api/auth/profile');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });
  });

  describe('GET /api/auth', () => {
    it('should return 200 OK and the auth endpoints', async () => {
      const res = await request(newApp()).get('/api/auth');
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

  describe('GET /api/auth/config', () => {
    it('should return 200 OK and the default auth config', async () => {
      const res = await request(newApp()).get('/api/auth/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        usernamePasswordMethod: 'local',
        otherMethods: [],
      });
    });
  });
});
