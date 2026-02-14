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

import { describe, it, afterEach, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

import { getProxyURL } from '../src/service/urls';
import * as config from '../src/config';

const genSimpleServer = () => {
  const app = express();
  app.get('/', (req, res) => {
    res.type('html');
    res.send(getProxyURL(req));
  });
  return app;
};

describe('proxyURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pulls the request path with no override', async () => {
    const app = genSimpleServer();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);

    // request url without trailing slash
    const reqURL = res.request.url.slice(0, -1);
    expect(res.text).toBe(reqURL);
    expect(res.text).toMatch(/https?:\/\/127.0.0.1:\d+/);
  });

  it('can override providing a proxy value', async () => {
    const proxyURL = 'https://amazing-proxy.path.local';

    // stub getDomains
    const spy = vi.spyOn(config, 'getDomains').mockReturnValue({ proxy: proxyURL });

    const app = genSimpleServer();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);

    // the stub worked
    expect(spy).toHaveBeenCalledTimes(1);

    expect(res.text).toBe(proxyURL);
  });
});
