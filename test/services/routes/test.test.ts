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

import { describe, it, expect, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import testRouter from '../../../src/service/routes/test';
import * as db from '../../../src/db';

const newApp = (user?: { username: string; admin: boolean }): Express => {
  const app = express();
  app.use(express.json());

  if (user) {
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
  }

  app.use('/test', testRouter);
  return app;
};

describe('Test cleanup API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires an admin user before deleting push data', async () => {
    const deletePush = vi.spyOn(db, 'deletePush').mockResolvedValue();

    const res = await request(newApp({ username: 'alice', admin: false })).delete(
      '/test/push/push-1',
    );

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Admin access required' });
    expect(deletePush).not.toHaveBeenCalled();
  });

  it('deletes push data for admin users', async () => {
    const deletePush = vi.spyOn(db, 'deletePush').mockResolvedValue();

    const res = await request(newApp({ username: 'admin', admin: true })).delete(
      '/test/push/push-1',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Push push-1 deleted' });
    expect(deletePush).toHaveBeenCalledWith('push-1');
  });

  it('deletes user data for admin users', async () => {
    const deleteUser = vi.spyOn(db, 'deleteUser').mockResolvedValue();

    const res = await request(newApp({ username: 'admin', admin: true })).delete(
      '/test/user/alice',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'User alice deleted' });
    expect(deleteUser).toHaveBeenCalledWith('alice');
  });

  it('returns cleanup failures without leaking implementation errors', async () => {
    vi.spyOn(db, 'deleteUser').mockRejectedValue(new Error());

    const res = await request(newApp({ username: 'admin', admin: true })).delete(
      '/test/user/alice',
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Failed to delete user' });
  });
});
