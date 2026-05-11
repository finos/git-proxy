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
import {
  createUser,
  findUser,
  findUserByEmail,
  findUserByOIDC,
  getUsers,
  updateUser,
  deleteUser,
} from '../../../src/db/postgres/users';
import { User } from '../../../src/db/types';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

describe.runIf(shouldRunPostgresTests)('PostgreSQL Users Integration Tests', () => {
  const createTestUser = (overrides: Partial<User> = {}): User => {
    const timestamp = Date.now();
    return new User(
      overrides.username || `testuser-${timestamp}`,
      overrides.password || 'hashedpassword123',
      overrides.gitAccount || `git-${timestamp}`,
      overrides.email || `test-${timestamp}@example.com`,
      overrides.admin ?? false,
      overrides.oidcId || null,
    );
  };

  describe('createUser', () => {
    it('lowercases username and email on insert', async () => {
      const user = createTestUser({ username: 'CreateUser', email: 'Create@Example.COM' });
      await createUser(user);

      const found = await findUser('createuser');
      expect(found?.username).toBe('createuser');
      expect(found?.email).toBe('create@example.com');
    });
  });

  describe('findUser', () => {
    it('finds a user by username (case-insensitive)', async () => {
      await createUser(createTestUser({ username: 'findme' }));
      const result = await findUser('FINDME');
      expect(result?.username).toBe('findme');
    });

    it('returns null for a non-existent user', async () => {
      expect(await findUser('non-existent-user')).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('finds a user by email (case-insensitive)', async () => {
      await createUser(createTestUser({ email: 'findbyemail@test.com' }));
      const result = await findUserByEmail('FindByEmail@TEST.com');
      expect(result?.email).toBe('findbyemail@test.com');
    });

    it('returns null for a non-existent email', async () => {
      expect(await findUserByEmail('nonexistent@test.com')).toBeNull();
    });
  });

  describe('findUserByOIDC', () => {
    it('finds a user by OIDC ID', async () => {
      const oidcId = `oidc-${Date.now()}`;
      await createUser(createTestUser({ oidcId }));
      const result = await findUserByOIDC(oidcId);
      expect(result?.oidcId).toBe(oidcId);
    });

    it('returns null for a non-existent OIDC ID', async () => {
      expect(await findUserByOIDC('non-existent-oidc')).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('retrieves users without their password', async () => {
      await createUser(createTestUser({ username: 'getusers1' }));
      await createUser(createTestUser({ username: 'getusers2' }));

      const result = await getUsers();

      expect(result.length).toBeGreaterThanOrEqual(2);
      result.forEach((user) => {
        // Mirrors mongo's projection — passwords are null in list responses.
        expect(user.password).toBeNull();
      });
    });

    it('filters by username (lowercased)', async () => {
      await createUser(createTestUser({ username: 'filteruser', email: 'filter@test.com' }));
      await createUser(createTestUser({ username: 'otheruser', email: 'other@test.com' }));

      const result = await getUsers({ username: 'FilterUser' });

      expect(result.length).toBe(1);
      expect(result[0].username).toBe('filteruser');
    });

    it('filters by email (lowercased)', async () => {
      await createUser(createTestUser({ username: 'emailfilter', email: 'unique-email@test.com' }));

      const result = await getUsers({ email: 'Unique-Email@TEST.com' });

      expect(result.length).toBe(1);
      expect(result[0].email).toBe('unique-email@test.com');
    });
  });

  describe('updateUser', () => {
    it('updates by username and lowercases new fields', async () => {
      await createUser(createTestUser({ username: 'updateme', admin: false }));

      await updateUser({ username: 'UpdateMe', admin: true });

      const updated = await findUser('updateme');
      expect(updated?.admin).toBe(true);
    });

    it('updates by _id when provided', async () => {
      await createUser(createTestUser({ username: 'updatebyid' }));
      const created = await findUser('updatebyid');
      await updateUser({ _id: created?._id as string, gitAccount: 'new-git-account' });

      const updated = await findUser('updatebyid');
      expect(updated?.gitAccount).toBe('new-git-account');
    });

    it('lowercases email during update', async () => {
      await createUser(createTestUser({ username: 'lowercaseupdate' }));
      await updateUser({ username: 'LowerCaseUpdate', email: 'NEW@EMAIL.COM' });

      const updated = await findUser('lowercaseupdate');
      expect(updated?.email).toBe('new@email.com');
    });

    it('inserts when no row matches and only username is provided', async () => {
      await updateUser({
        username: 'brand-new-user',
        email: 'brand-new@example.com',
        gitAccount: 'brand-new-git',
      });

      const inserted = await findUser('brand-new-user');
      expect(inserted?.email).toBe('brand-new@example.com');
      expect(inserted?.gitAccount).toBe('brand-new-git');
    });
  });

  describe('deleteUser', () => {
    it('deletes a user by username (case-insensitive)', async () => {
      await createUser(createTestUser({ username: 'deleteme' }));
      await deleteUser('DeleteMe');
      expect(await findUser('deleteme')).toBeNull();
    });
  });
});
