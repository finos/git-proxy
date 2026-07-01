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

import { describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { RegisterRoutes } from '../../../src/service/generatedRoutes';

describe('Health Check API', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    RegisterRoutes(app);
  });

  it('GET /api/v1/healthcheck should return 200 OK and the health check message', async () => {
    const res = await request(app).get('/api/v1/healthcheck');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'ok' });
  });
});
