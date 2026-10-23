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

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Action, RequestType } from '../../src/proxy/actions/Action';
import { exec as parsePush } from '../../src/proxy/processors/pre-processor/parsePush';

describe('parsePush HTTP request handling', () => {
  it('rejects malformed push data and records the parsing error', async () => {
    const app = express();
    app.post('/git-receive-pack', express.raw({ type: '*/*' }), async (req, res) => {
      const action = new Action(
        'invalid-pack',
        RequestType.PUSH,
        'POST',
        0,
        'https://example.com/test/repo.git',
      );
      res.json(await parsePush(req, action));
    });

    const response = await request(app)
      .post('/git-receive-pack')
      .set('Content-Type', 'application/x-git-receive-pack-request')
      .send(Buffer.from('invalid-pack-data'));

    expect(response.body).toMatchObject({
      error: true,
      allowPush: false,
      authorised: false,
      steps: [
        {
          stepName: 'parsePackFile',
          error: true,
          errorMessage: expect.stringContaining('Invalid packet line length'),
          logs: [expect.stringContaining('Invalid packet line length')],
        },
      ],
    });
  });
});
