import { describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import healthcheck from '../../../src/service/routes/healthcheck';

describe('Health Check API', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/healthCheck', healthcheck);
  });

  it('GET /healthCheck should return 200 OK and the health check message', async () => {
    const res = await request(app).get('/healthCheck');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'ok' });
  });
});
