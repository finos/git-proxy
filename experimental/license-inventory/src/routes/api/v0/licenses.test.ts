/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
import { describe, it, expect, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '@/app';
import { genMockLicenseDataService } from '@/test/mock/db';

const basePath = '/api/v0/licenses';
const genRoute = (p: string) => basePath + p;

describe(basePath, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET / - list', () => {
    it('no data', async () => {
      const mockLDS = genMockLicenseDataService();
      mockLDS.list.mockResolvedValueOnce({ error: null, data: [] });
      const app = createApp(mockLDS);
      const res = await request(app).get(genRoute('/')).expect('Content-Type', /json/).expect(200);

      expect(res.body).toEqual([]);
    });

    it('one entry', async () => {
      const inputData = {
        id: uuidv4(),
        name: 'test',
      };
      const mockLDS = genMockLicenseDataService();
      mockLDS.list.mockResolvedValueOnce({ error: null, data: [inputData] });
      const app = createApp(mockLDS);
      const res = await request(app).get(genRoute('/')).expect('Content-Type', /json/).expect(200);

      expect(res.body).toEqual([inputData]);
    });
  });

  describe(`GET /:id - read`, () => {
    const testID = '157c0c6a-5c99-4298-9529-95816da2255a';
    it('invalid id - not uuid', async () => {
      const mockLDS = genMockLicenseDataService();
      mockLDS.getByUUID.mockRejectedValueOnce(null);
      const app = createApp(mockLDS);
      await request(app)
        .get(genRoute('/' + 'apache-2_0'))
        .expect('Content-Type', /json/)
        .expect(500);
      expect(mockLDS.getByUUID.mock.lastCall).toBeUndefined();
    });

    it('valid id - no data', async () => {
      const mockLDS = genMockLicenseDataService();
      mockLDS.getByUUID.mockResolvedValueOnce({ error: null, data: null });
      const app = createApp(mockLDS);
      const res = await request(app)
        .get(genRoute('/' + testID))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toEqual({ license: null });
    });

    it('valid id - data', async () => {
      const licenseData = {
        id: testID,
        name: 'test',
      };
      const mockLDS = genMockLicenseDataService();
      mockLDS.getByUUID.mockResolvedValueOnce({ error: null, data: licenseData });
      const app = createApp(mockLDS);
      const res = await request(app)
        .get(genRoute('/' + testID))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toEqual({ license: licenseData });
    });
  });
});
