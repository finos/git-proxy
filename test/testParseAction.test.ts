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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as preprocessor from '../src/proxy/processors/pre-processor/parseAction';
import * as db from '../src/db';

let testRepo: any = null;

const TEST_REPO = {
  url: 'https://github.com/finos/git-proxy.git',
  name: 'git-proxy',
  project: 'finos',
};

describe('Pre-processor: parseAction', () => {
  beforeAll(async () => {
    // make sure the test repo exists as the presence of the repo makes a difference to handling of urls
    testRepo = await db.getRepoByUrl(TEST_REPO.url);
    if (!testRepo) {
      testRepo = await db.createRepo(TEST_REPO);
    }
  });

  afterAll(async () => {
    // If we created the testRepo, clean it up
    if (testRepo?._id) {
      await db.deleteRepo(testRepo._id);
    }
  });

  it('should be able to parse a pull request into an action', async () => {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: { 'content-type': 'application/x-git-upload-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('pull');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a pull request with a legacy path into an action', async () => {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-upload-pack',
      method: 'GET',
      headers: { 'content-type': 'application/x-git-upload-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('pull');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request into an action', async () => {
    const req = {
      originalUrl: '/github.com/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('push');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });

  it('should be able to parse a push request with a legacy path into an action', async () => {
    const req = {
      originalUrl: '/finos/git-proxy.git/git-receive-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
    };

    const action = await preprocessor.exec(req);
    expect(action.timestamp).toBeGreaterThan(0);
    expect(action.id).not.toBeFalsy();
    expect(action.type).toBe('push');
    expect(action.url).toBe('https://github.com/finos/git-proxy.git');
  });
});
