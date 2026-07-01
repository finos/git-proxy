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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { RegisterRoutes } from '../../../src/service/generatedRoutes';
import * as db from '../../../src/db';
import { utils } from 'ssh2';
import crypto from 'crypto';

describe('Users API', () => {
  let app: Express;
  // The authenticated user for the current request. Tests reassign this to
  // exercise different users; set it to undefined for the unauthenticated case.
  let currentUser: { username: string; admin?: boolean } | undefined;

  beforeEach(() => {
    currentUser = { username: 'testuser' };
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      // tsoa's @Security('jwt') middleware overwrites req.user with whatever
      // expressAuthentication returns. With a session (isAuthenticated() === true)
      // it returns the existing req.user, so mark the request as session-authenticated.
      if (currentUser) {
        req.user = currentUser;
        (req as any).isAuthenticated = () => true;
      }
      next();
    });
    RegisterRoutes(app);
    app.use((err: any, _req: any, res: any, next: any) => {
      if (res.headersSent) return next(err);
      res.status(err.status ?? 500).json({ message: err.message });
    });

    vi.spyOn(db, 'getUsers').mockResolvedValue([
      {
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
        gitAccount: '',
        admin: false,
      },
    ]);

    vi.spyOn(db, 'findUser').mockResolvedValue({
      username: 'bob',
      password: 'hidden',
      email: 'bob@example.com',
      displayName: '',
      gitAccount: '',
      admin: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/user only serializes public data needed for ui, not user secrets like password', async () => {
    const res = await request(app).get('/api/v1/user');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      },
    ]);
  });

  it('GET /api/v1/user/:id does not serialize password', async () => {
    const res = await request(app).get('/api/v1/user/bob');

    expect(res.status).toBe(200);
    console.log(`Response body: ${JSON.stringify(res.body)}`);
    expect(res.body).toEqual({
      username: 'bob',
      displayName: '',
      email: 'bob@example.com',
      title: '',
      gitAccount: '',
      admin: false,
    });
  });

  describe('SSH Key Management', () => {
    beforeEach(() => {
      // Mock SSH key operations
      vi.spyOn(db, 'getPublicKeys').mockResolvedValue([
        {
          key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest',
          fingerprint: 'SHA256:testfingerprint123',
          name: 'Test Key',
          addedAt: '2024-01-01T00:00:00Z',
        },
      ] as any);

      vi.spyOn(db, 'addPublicKey').mockResolvedValue(undefined);
      vi.spyOn(db, 'removePublicKey').mockResolvedValue(undefined);
    });

    describe('GET /api/v1/user/:username/ssh-key-fingerprints', () => {
      it('should return 401 when not authenticated', async () => {
        currentUser = undefined;
        const res = await request(app).get('/api/v1/user/alice/ssh-key-fingerprints');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to view other user keys', async () => {
        currentUser = { username: 'bob', admin: false };
        const res = await request(app).get('/api/v1/user/alice/ssh-key-fingerprints');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to view keys for this user' });
      });

      it('should allow user to view their own keys', async () => {
        currentUser = { username: 'alice', admin: false };
        const res = await request(app).get('/api/v1/user/alice/ssh-key-fingerprints');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([
          {
            fingerprint: 'SHA256:testfingerprint123',
            name: 'Test Key',
            addedAt: '2024-01-01T00:00:00Z',
          },
        ]);
      });

      it('should allow admin to view any user keys', async () => {
        currentUser = { username: 'admin', admin: true };
        const res = await request(app).get('/api/v1/user/alice/ssh-key-fingerprints');

        expect(res.status).toBe(200);
        expect(db.getPublicKeys).toHaveBeenCalledWith('alice');
      });

      it('should handle errors when retrieving keys', async () => {
        vi.spyOn(db, 'getPublicKeys').mockRejectedValue(new Error('Database error'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app).get('/api/v1/user/alice/ssh-key-fingerprints');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Failed to retrieve SSH keys' });
      });
    });

    describe('POST /api/v1/user/:username/ssh-keys', () => {
      const validPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com';

      beforeEach(() => {
        // Mock SSH key parsing and fingerprint calculation
        vi.spyOn(utils, 'parseKey').mockReturnValue({
          getPublicSSH: () => Buffer.from('test-key-data'),
        } as any);

        vi.spyOn(crypto, 'createHash').mockReturnValue({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn().mockReturnValue('testbase64hash'),
        } as any);
      });

      it('should return 401 when not authenticated', async () => {
        currentUser = undefined;
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to add key for other user', async () => {
        currentUser = { username: 'bob', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to add keys for this user' });
      });

      it('should return 400 when public key is missing', async () => {
        currentUser = { username: 'alice', admin: false };
        const res = await request(app).post('/api/v1/user/alice/ssh-keys').send({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Public key is required' });
      });

      it('should return 400 when public key format is invalid', async () => {
        vi.spyOn(utils, 'parseKey').mockReturnValue(null as any);

        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: 'invalid-key' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid SSH public key format' });
      });

      it('should successfully add SSH key', async () => {
        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey, name: 'My Key' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          message: 'SSH key added successfully',
          fingerprint: 'SHA256:testbase64hash',
        });
        expect(db.addPublicKey).toHaveBeenCalledWith(
          'alice',
          expect.objectContaining({
            name: 'My Key',
            fingerprint: 'SHA256:testbase64hash',
          }),
        );
      });

      it('should use default name when name not provided', async () => {
        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(201);
        expect(db.addPublicKey).toHaveBeenCalledWith(
          'alice',
          expect.objectContaining({
            name: 'Unnamed Key',
          }),
        );
      });

      it('should return 409 when key already exists', async () => {
        vi.spyOn(db, 'addPublicKey').mockRejectedValue(new Error('SSH key already exists'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'This SSH key already exists' });
      });

      it('should return 404 when user not found', async () => {
        vi.spyOn(db, 'addPublicKey').mockRejectedValue(new Error('User not found'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
      });

      it('should return 500 for other errors', async () => {
        vi.spyOn(db, 'addPublicKey').mockRejectedValue(new Error('Database error'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Database error' });
      });

      it('should allow admin to add key for any user', async () => {
        currentUser = { username: 'admin', admin: true };
        const res = await request(app)
          .post('/api/v1/user/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(201);
        expect(db.addPublicKey).toHaveBeenCalledWith('alice', expect.any(Object));
      });
    });

    describe('DELETE /api/v1/user/:username/ssh-keys/:fingerprint', () => {
      it('should return 401 when not authenticated', async () => {
        currentUser = undefined;
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to remove key for other user', async () => {
        currentUser = { username: 'bob', admin: false };
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to remove keys for this user' });
      });

      it('should successfully remove SSH key', async () => {
        currentUser = { username: 'alice', admin: false };
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'SSH key removed successfully' });
        expect(db.removePublicKey).toHaveBeenCalledWith('alice', 'SHA256:test123');
      });

      it('should return 404 when user not found', async () => {
        vi.spyOn(db, 'removePublicKey').mockRejectedValue(new Error('User not found'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
      });

      it('should return 500 for other errors', async () => {
        vi.spyOn(db, 'removePublicKey').mockRejectedValue(new Error('Database error'));

        currentUser = { username: 'alice', admin: false };
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Database error' });
      });

      it('should allow admin to remove key for any user', async () => {
        currentUser = { username: 'admin', admin: true };
        const res = await request(app).delete('/api/v1/user/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(200);
        expect(db.removePublicKey).toHaveBeenCalledWith('alice', 'SHA256:test123');
      });
    });
  });

  it('GET /api/v1/user/:id should return 404 Not Found if user is not found', async () => {
    vi.restoreAllMocks();

    const res = await request(app).get('/api/v1/user/non-existent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'User non-existent not found' });
  });
});
