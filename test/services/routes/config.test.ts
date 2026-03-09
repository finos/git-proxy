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
import configRouter from '../../../src/service/routes/config';
import * as config from '../../../src/config';

describe('Config API', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/config', configRouter);

    vi.spyOn(config, 'getAttestationConfig').mockReturnValue({ questions: [] });
    vi.spyOn(config, 'getURLShortener').mockReturnValue('https://url-shortener.com');
    vi.spyOn(config, 'getContactEmail').mockReturnValue('test@example.com');
    vi.spyOn(config, 'getUIRouteAuth').mockReturnValue({ enabled: false, rules: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /config/attestation should return 200 OK and the default attestation config', async () => {
    const res = await request(app).get('/config/attestation');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ questions: [] });
  });

  it('GET /config/urlShortener should return 200 OK and the default url shortener config', async () => {
    const res = await request(app).get('/config/urlShortener');
    expect(res.status).toBe(200);
    expect(res.text).toBe('https://url-shortener.com'); // Check res.text as it gets serialized as a string
  });

  it('GET /config/contactEmail should return 200 OK and the default contact email', async () => {
    const res = await request(app).get('/config/contactEmail');
    expect(res.status).toBe(200);
    expect(res.text).toBe('test@example.com');
  });

  it('GET /config/uiRouteAuth should return 200 OK and the default ui route auth config', async () => {
    const res = await request(app).get('/config/uiRouteAuth');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, rules: [] });
  });
});
