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
