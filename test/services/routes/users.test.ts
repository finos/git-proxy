/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import usersRouter from '../../../src/service/routes/users';
import * as db from '../../../src/db';

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
});
