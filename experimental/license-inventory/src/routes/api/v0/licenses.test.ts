import { describe, it, expect, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { License } from '@/db/collections';
import { app } from '@/app';

const basePath = '/api/v0/licenses';
const genRoute = (p: string) => basePath + p;

describe(basePath, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET / - list', () => {
    it('no data', async () => {
      const execMock = jest.fn(() => Promise.resolve([]));
      jest.spyOn(License, 'find').mockReturnValueOnce({
        exec: execMock,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const res = await request(app).get(genRoute('/')).expect('Content-Type', /json/).expect(200);

      expect(res.body).toEqual([]);
    });

    it('one entry', async () => {
      const inputData = {
        id: 'test',
        name: 'test',
      };
      const execMock = jest.fn(() => Promise.resolve([{ toJSON: async () => inputData }]));
      jest.spyOn(License, 'find').mockReturnValueOnce({
        exec: execMock,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const res = await request(app).get(genRoute('/')).expect('Content-Type', /json/).expect(200);

      expect(res.body).toEqual([inputData]);
    });
  });
});
