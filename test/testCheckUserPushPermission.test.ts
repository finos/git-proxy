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

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as processor from '../src/proxy/processors/push-action/checkUserPushPermission';
import { Action } from '../src/proxy/actions/Action';
import * as db from '../src/db';

const TEST_ORG = 'finos';
const TEST_REPO = 'user-push-perms-test.git';
const TEST_URL = 'https://github.com/finos/user-push-perms-test.git';
const TEST_USERNAME_1 = 'push-perms-test';
const TEST_EMAIL_1 = 'push-perms-test@test.com';
const TEST_USERNAME_2 = 'push-perms-test-2';
const TEST_EMAIL_2 = 'push-perms-test-2@test.com';
const TEST_EMAIL_3 = 'push-perms-test-3@test.com';

describe('CheckUserPushPermissions...', () => {
  let testRepo: Required<db.Repo> | null = null;

  beforeAll(async () => {
    testRepo = await db.createRepo({
      project: TEST_ORG,
      name: TEST_REPO,
      url: TEST_URL,
    });

    await db.createUser(TEST_USERNAME_1, 'abc', TEST_EMAIL_1, TEST_USERNAME_1, false);
    await db.addUserCanPush(testRepo._id, TEST_USERNAME_1);
    await db.createUser(TEST_USERNAME_2, 'abc', TEST_EMAIL_2, TEST_USERNAME_2, false);
  });

  afterAll(async () => {
    await db.deleteRepo(testRepo!._id);
    await db.deleteUser(TEST_USERNAME_1);
    await db.deleteUser(TEST_USERNAME_2);
  });

  it('A committer that is approved should be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_URL);
    action.userEmail = TEST_EMAIL_1;
    const { error } = await processor.exec(null as any, action);
    expect(error).toBe(false);
  });

  it('A committer that is NOT approved should NOT be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_URL);
    action.userEmail = TEST_EMAIL_2;
    const { error, errorMessage } = await processor.exec(null as any, action);
    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });

  it('An unknown committer should NOT be allowed to push...', async () => {
    const action = new Action('1', 'type', 'method', 1, TEST_URL);
    action.userEmail = TEST_EMAIL_3;
    const { error, errorMessage } = await processor.exec(null as any, action);
    expect(error).toBe(true);
    expect(errorMessage).toContain('Your push has been blocked');
  });
});
