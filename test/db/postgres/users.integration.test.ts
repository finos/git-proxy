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
  findUserBySSHKey,
  getUsers,
  updateUser,
  deleteUser,
  addPublicKey,
  removePublicKey,
  getPublicKeys,
} from '../../../src/db/postgres/users';
import { DuplicateSSHKeyError } from '../../../src/errors/DatabaseErrors';
import { PublicKeyRecord, User } from '../../../src/db/types';

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

  describe('SSH public keys', () => {
    const makeKey = (suffix: string): PublicKeyRecord => ({
      key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5-${suffix}`,
      name: `key-${suffix}`,
      addedAt: new Date().toISOString(),
      fingerprint: `SHA256:${suffix}`,
    });

    it('starts with an empty publicKeys array', async () => {
      await createUser(createTestUser({ username: 'sshempty' }));
      await expect(getPublicKeys('sshempty')).resolves.toEqual([]);
    });

    it('adds a key and finds the user by it', async () => {
      const key = makeKey('add-and-find');
      await createUser(createTestUser({ username: 'sshadd' }));
      await addPublicKey('sshadd', key);

      await expect(getPublicKeys('sshadd')).resolves.toEqual([key]);
      const found = await findUserBySSHKey(key.key);
      expect(found?.username).toBe('sshadd');
    });

    it('rejects a key already registered to another user', async () => {
      const key = makeKey('cross-user');
      await createUser(createTestUser({ username: 'sshowner' }));
      await createUser(createTestUser({ username: 'sshthief' }));
      await addPublicKey('sshowner', key);

      await expect(addPublicKey('sshthief', key)).rejects.toThrow(DuplicateSSHKeyError);
    });

    it('rejects a duplicate key for the same user', async () => {
      const key = makeKey('same-user-dup');
      await createUser(createTestUser({ username: 'sshdup' }));
      await addPublicKey('sshdup', key);

      await expect(addPublicKey('sshdup', key)).rejects.toThrow('SSH key already exists');
    });

    it('rejects adding a key for a missing user', async () => {
      await expect(addPublicKey('ssh-ghost', makeKey('ghost'))).rejects.toThrow('User not found');
    });

    it('removes a key by fingerprint and leaves the rest', async () => {
      const keep = makeKey('keep');
      const drop = makeKey('drop');
      await createUser(createTestUser({ username: 'sshremove' }));
      await addPublicKey('sshremove', keep);
      await addPublicKey('sshremove', drop);

      await removePublicKey('sshremove', drop.fingerprint);

      await expect(getPublicKeys('sshremove')).resolves.toEqual([keep]);
      expect(await findUserBySSHKey(drop.key)).toBeNull();
    });

    it('keeps an empty array (not null) after the last key is removed', async () => {
      const key = makeKey('last-key');
      await createUser(createTestUser({ username: 'sshlast' }));
      await addPublicKey('sshlast', key);
      await removePublicKey('sshlast', key.fingerprint);

      await expect(getPublicKeys('sshlast')).resolves.toEqual([]);
    });

    it('is a no-op when removing an unknown fingerprint', async () => {
      const key = makeKey('stable');
      await createUser(createTestUser({ username: 'sshnoop' }));
      await addPublicKey('sshnoop', key);

      await removePublicKey('sshnoop', 'SHA256:does-not-exist');

      await expect(getPublicKeys('sshnoop')).resolves.toEqual([key]);
    });

    it('round-trips publicKeys through createUser', async () => {
      const key = makeKey('roundtrip');
      const user = createTestUser({ username: 'sshseeded' });
      user.publicKeys = [key];
      await createUser(user);

      await expect(getPublicKeys('sshseeded')).resolves.toEqual([key]);
    });
  });
});
