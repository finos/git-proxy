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

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { exec as clearBareClone } from '../../src/proxy/processors/push-action/clearBareClone';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { Action } from '../../src/proxy/actions/Action';

const actionId = '123__456';
const timestamp = Date.now();

describe('clear bare and local clones', () => {
  it('pull remote generates a local .remote folder', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    action.url = 'https://github.com/finos/git-proxy.git';
    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    expect(fs.existsSync(`./.remote/${actionId}`)).toBe(true);
  }, 20000);

  it('clear bare clone function purges .remote folder and specific clone folder', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    await clearBareClone(null, action);

    expect(fs.existsSync(`./.remote`)).toBe(false);
    expect(fs.existsSync(`./.remote/${actionId}`)).toBe(false);
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmSync(`./.remote`, { recursive: true });
    }
  });
});
