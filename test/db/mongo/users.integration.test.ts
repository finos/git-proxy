import { describe, it, expect } from 'vitest';
import {
  createUser,
  findUser,
  findUserByEmail,
  findUserByOIDC,
  getUsers,
  updateUser,
  deleteUser,
} from '../../../src/db/mongo/users';
import { User } from '../../../src/db/types';

const shouldRunMongoTests = process.env.RUN_MONGO_TESTS === 'true';

describe.runIf(shouldRunMongoTests)('MongoDB Users Integration Tests', () => {
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
    it('should create a user with lowercased username and email', async () => {
      const user = createTestUser({
        username: 'CreateUser',
        email: 'Create@Example.COM',
      });

      await createUser(user);

      const found = await findUser('createuser');
      expect(found).not.toBeNull();
      expect(found?.username).toBe('createuser');
      expect(found?.email).toBe('create@example.com');
    });
  });

  describe('findUser', () => {
    it('should find a user by username (case-insensitive)', async () => {
      const user = createTestUser({ username: 'findme' });
      await createUser(user);

      const result = await findUser('FINDME');

      expect(result).not.toBeNull();
      expect(result?.username).toBe('findme');
    });

    it('should return null for non-existent user', async () => {
      const result = await findUser('non-existent-user');

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should find a user by email (case-insensitive)', async () => {
      const user = createTestUser({ email: 'findbyemail@test.com' });
      await createUser(user);

      const result = await findUserByEmail('FindByEmail@TEST.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('findbyemail@test.com');
    });

    it('should return null for non-existent email', async () => {
      const result = await findUserByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserByOIDC', () => {
    it('should find a user by OIDC ID', async () => {
      const oidcId = `oidc-${Date.now()}`;
      const user = createTestUser({ oidcId });
      await createUser(user);

      const result = await findUserByOIDC(oidcId);

      expect(result).not.toBeNull();
      expect(result?.oidcId).toBe(oidcId);
    });

    it('should return null for non-existent OIDC ID', async () => {
      const result = await findUserByOIDC('non-existent-oidc');

      expect(result).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('should retrieve all users without passwords', async () => {
      await createUser(createTestUser({ username: 'getusers1' }));
      await createUser(createTestUser({ username: 'getusers2' }));

      const result = await getUsers();

      expect(result.length).toBeGreaterThanOrEqual(2);
      result.forEach((user) => {
        expect(user.password).toBeUndefined();
      });
    });

    it('should filter users by query (lowercased)', async () => {
      await createUser(createTestUser({ username: 'filteruser', email: 'filter@test.com' }));
      await createUser(createTestUser({ username: 'otheruser', email: 'other@test.com' }));

      const result = await getUsers({ username: 'FilterUser' });

      expect(result.length).toBe(1);
      expect(result[0].username).toBe('filteruser');
    });

    it('should filter by email (lowercased)', async () => {
      await createUser(createTestUser({ username: 'emailfilter', email: 'unique-email@test.com' }));

      const result = await getUsers({ email: 'Unique-Email@TEST.com' });

      expect(result.length).toBe(1);
      expect(result[0].email).toBe('unique-email@test.com');
    });
  });

  describe('updateUser', () => {
    it('should update user by username', async () => {
      const user = createTestUser({ username: 'updateme', admin: false });
      await createUser(user);

      await updateUser({ username: 'UpdateMe', admin: true });

      const updated = await findUser('updateme');
      expect(updated?.admin).toBe(true);
    });

    it('should update user by _id when provided', async () => {
      const user = createTestUser({ username: 'updatebyid' });
      await createUser(user);

      const created = await findUser('updatebyid');
      await updateUser({ _id: (created as any)._id.toString(), gitAccount: 'new-git-account' });

      const updated = await findUser('updatebyid');
      expect(updated?.gitAccount).toBe('new-git-account');
    });

    it('should lowercase username and email during update', async () => {
      const user = createTestUser({ username: 'lowercaseupdate' });
      await createUser(user);

      await updateUser({ username: 'LowerCaseUpdate', email: 'NEW@EMAIL.COM' });

      const updated = await findUser('lowercaseupdate');
      expect(updated?.email).toBe('new@email.com');
    });
  });

  describe('deleteUser', () => {
    it('should delete a user by username (case-insensitive)', async () => {
      const user = createTestUser({ username: 'deleteme' });
      await createUser(user);

      await deleteUser('DeleteMe');

      const result = await findUser('deleteme');
      expect(result).toBeNull();
    });
  });
});
