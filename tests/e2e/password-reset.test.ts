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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';
import { testConfig } from './setup';

type LoginResponse = {
  message: string;
  user?: {
    username: string;
    mustChangePassword?: boolean;
  };
};

const getCookieHeader = (response: Response): string => {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie returned by login endpoint');
  }
  return setCookie.split(';')[0];
};

const login = async (
  username: string,
  password: string,
): Promise<{ response: Response; body: LoginResponse; cookie: string }> => {
  const response = await fetch(`${testConfig.gitProxyUiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let body: LoginResponse = { message: '' };
  try {
    body = (await response.json()) as LoginResponse;
  } catch {
    // ignore non-json error bodies
  }
  const cookie = response.ok ? getCookieHeader(response) : '';
  return { response, body, cookie };
};

describe.sequential('Git Proxy E2E - Password reset flow', () => {
  let mongoClient: MongoClient;
  const mongoConnectionString = process.env.E2E_MONGO_URL || 'mongodb://localhost:27017/gitproxy';

  beforeAll(async () => {
    mongoClient = new MongoClient(mongoConnectionString);
    await mongoClient.connect();
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  it(
    'forces password update before protected API access and allows access after reset',
    async () => {
      const now = Date.now();
      const username = `pwdreset-${now}`;
      const initialPassword = `Initial-${now}-pass`;
      const updatedPassword = `Updated-${now}-pass`;
      const email = `${username}@example.com`;

      // Create a local user via admin API.
      const adminLogin = await login('admin', 'admin');
      expect(adminLogin.response.status).toBe(200);
      const createResponse = await fetch(`${testConfig.gitProxyUiUrl}/api/auth/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminLogin.cookie,
        },
        body: JSON.stringify({
          username,
          password: initialPassword,
          email,
          gitAccount: username,
          admin: false,
        }),
      });
      expect(createResponse.status).toBe(201);

      // Simulate production first-login requirement by toggling the same server-side flag
      // used by production default accounts.
      const usersCollection = mongoClient.db('gitproxy').collection('users');
      await usersCollection.updateOne({ username }, { $set: { mustChangePassword: true } });

      const userLogin = await login(username, initialPassword);
      expect(userLogin.response.status).toBe(200);
      expect(userLogin.body.user?.mustChangePassword).toBe(true);

      // Protected endpoints should be blocked until password change.
      const blockedResponse = await fetch(`${testConfig.gitProxyUiUrl}/api/v1/repo`, {
        method: 'GET',
        headers: {
          Cookie: userLogin.cookie,
        },
      });
      expect(blockedResponse.status).toBe(428);

      // Change password through the dedicated endpoint.
      const changePasswordResponse = await fetch(
        `${testConfig.gitProxyUiUrl}/api/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userLogin.cookie,
          },
          body: JSON.stringify({
            currentPassword: initialPassword,
            newPassword: updatedPassword,
          }),
        },
      );
      expect(changePasswordResponse.status).toBe(200);

      // Access should be restored after password update.
      const unblockedResponse = await fetch(`${testConfig.gitProxyUiUrl}/api/v1/repo`, {
        method: 'GET',
        headers: {
          Cookie: userLogin.cookie,
        },
      });
      expect(unblockedResponse.status).toBe(200);

      // Old password no longer works.
      const oldPasswordLogin = await login(username, initialPassword);
      expect(oldPasswordLogin.response.status).toBe(401);

      // New password succeeds and no longer requires reset.
      const newPasswordLogin = await login(username, updatedPassword);
      expect(newPasswordLogin.response.status).toBe(200);
      expect(newPasswordLogin.body.user?.mustChangePassword).not.toBe(true);
    },
    testConfig.timeout * 2,
  );
});
