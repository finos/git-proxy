import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import usersRouter from '../../../src/service/routes/users';
import * as db from '../../../src/db';
import { utils } from 'ssh2';
import crypto from 'crypto';

describe('Users API', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', usersRouter);

    vi.spyOn(db, 'getUsers').mockResolvedValue([
      {
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
      },
    ] as any);

    vi.spyOn(db, 'findUser').mockResolvedValue({
      username: 'bob',
      password: 'hidden',
      email: 'bob@example.com',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /users only serializes public data needed for ui, not user secrets like password', async () => {
    const res = await request(app).get('/users');

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

  it('GET /users/:id does not serialize password', async () => {
    const res = await request(app).get('/users/bob');

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

    describe('GET /users/:username/ssh-key-fingerprints', () => {
      it('should return 401 when not authenticated', async () => {
        const res = await request(app).get('/users/alice/ssh-key-fingerprints');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to view other user keys', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'bob', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).get('/users/alice/ssh-key-fingerprints');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to view keys for this user' });
      });

      it('should allow user to view their own keys', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).get('/users/alice/ssh-key-fingerprints');

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
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'admin', admin: true };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).get('/users/alice/ssh-key-fingerprints');

        expect(res.status).toBe(200);
        expect(db.getPublicKeys).toHaveBeenCalledWith('alice');
      });

      it('should handle errors when retrieving keys', async () => {
        vi.spyOn(db, 'getPublicKeys').mockRejectedValue(new Error('Database error'));

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).get('/users/alice/ssh-key-fingerprints');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Failed to retrieve SSH keys' });
      });
    });

    describe('POST /users/:username/ssh-keys', () => {
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
        const res = await request(app)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to add key for other user', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'bob', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to add keys for this user' });
      });

      it('should return 400 when public key is missing', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).post('/users/alice/ssh-keys').send({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Public key is required' });
      });

      it('should return 400 when public key format is invalid', async () => {
        vi.spyOn(utils, 'parseKey').mockReturnValue(null as any);

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: 'invalid-key' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid SSH public key format' });
      });

      it('should successfully add SSH key', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
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
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
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

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'This SSH key already exists' });
      });

      it('should return 404 when user not found', async () => {
        vi.spyOn(db, 'addPublicKey').mockRejectedValue(new Error('User not found'));

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
      });

      it('should return 500 for other errors', async () => {
        vi.spyOn(db, 'addPublicKey').mockRejectedValue(new Error('Database error'));

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Database error' });
      });

      it('should allow admin to add key for any user', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'admin', admin: true };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp)
          .post('/users/alice/ssh-keys')
          .send({ publicKey: validPublicKey });

        expect(res.status).toBe(201);
        expect(db.addPublicKey).toHaveBeenCalledWith('alice', expect.any(Object));
      });
    });

    describe('DELETE /users/:username/ssh-keys/:fingerprint', () => {
      it('should return 401 when not authenticated', async () => {
        const res = await request(app).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Authentication required' });
      });

      it('should return 403 when non-admin tries to remove key for other user', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'bob', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Not authorized to remove keys for this user' });
      });

      it('should successfully remove SSH key', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'SSH key removed successfully' });
        expect(db.removePublicKey).toHaveBeenCalledWith('alice', 'SHA256:test123');
      });

      it('should return 404 when user not found', async () => {
        vi.spyOn(db, 'removePublicKey').mockRejectedValue(new Error('User not found'));

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
      });

      it('should return 500 for other errors', async () => {
        vi.spyOn(db, 'removePublicKey').mockRejectedValue(new Error('Database error'));

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'alice', admin: false };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Database error' });
      });

      it('should allow admin to remove key for any user', async () => {
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.user = { username: 'admin', admin: true };
          next();
        });
        testApp.use('/users', usersRouter);

        const res = await request(testApp).delete('/users/alice/ssh-keys/SHA256:test123');

        expect(res.status).toBe(200);
        expect(db.removePublicKey).toHaveBeenCalledWith('alice', 'SHA256:test123');
      });
    });
  });
});
