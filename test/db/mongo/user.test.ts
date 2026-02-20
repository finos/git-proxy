import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { User } from '../../../src/db/types';
import { ObjectId } from 'mongodb';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockToArray = vi.fn();
const mockProject = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();

const mockConnect = vi.fn(() => ({
  findOne: mockFindOne,
  find: mockFind,
  insertOne: mockInsertOne,
  updateOne: mockUpdateOne,
  deleteOne: mockDeleteOne,
}));

const mockToClass = vi.fn((doc, proto) => Object.assign(Object.create(proto), doc));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
}));

vi.mock('../../../src/db/helper', () => ({
  toClass: mockToClass,
}));

describe('MongoDB User', async () => {
  const {
    findUser,
    findUserByEmail,
    findUserByOIDC,
    getUsers,
    deleteUser,
    createUser,
    updateUser,
  } = await import('../../../src/db/mongo/users');

  const TEST_USER: Partial<User> = {
    _id: '507f1f77bcf86cd799439011',
    username: 'testuser',
    email: 'test@example.com',
    oidcId: 'test-oidc-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({
      project: mockProject,
    });
    mockProject.mockReturnValue({
      toArray: mockToArray,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findUser', () => {
    it('should find user by username', async () => {
      const userData = { ...TEST_USER };
      mockFindOne.mockResolvedValue(userData);
      mockToClass.mockReturnValue(userData);

      const result = await findUser('TestUser');

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockFindOne).toHaveBeenCalledWith({ username: { $eq: 'testuser' } });
      expect(mockToClass).toHaveBeenCalledWith(userData, User.prototype);
      expect(result).toEqual(userData);
    });

    it('should convert username to lowercase', async () => {
      mockFindOne.mockResolvedValue(TEST_USER);
      mockToClass.mockReturnValue(TEST_USER);

      await findUser('UPPERCASE');

      expect(mockFindOne).toHaveBeenCalledWith({ username: { $eq: 'uppercase' } });
    });

    it('should return null when user not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await findUser('nonexistent');

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const userData = { ...TEST_USER };
      mockFindOne.mockResolvedValue(userData);
      mockToClass.mockReturnValue(userData);

      const result = await findUserByEmail('Test@Example.com');

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockFindOne).toHaveBeenCalledWith({ email: { $eq: 'test@example.com' } });
      expect(mockToClass).toHaveBeenCalledWith(userData, User.prototype);
      expect(result).toEqual(userData);
    });

    it('should convert email to lowercase', async () => {
      mockFindOne.mockResolvedValue(TEST_USER);
      mockToClass.mockReturnValue(TEST_USER);

      await findUserByEmail('UPPERCASE@EXAMPLE.COM');

      expect(mockFindOne).toHaveBeenCalledWith({ email: { $eq: 'uppercase@example.com' } });
    });

    it('should return null when user not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('findUserByOIDC', () => {
    it('should find user by OIDC ID', async () => {
      const userData = { ...TEST_USER };
      mockFindOne.mockResolvedValue(userData);
      mockToClass.mockReturnValue(userData);

      const result = await findUserByOIDC('test-oidc-id');

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockFindOne).toHaveBeenCalledWith({ oidcId: { $eq: 'test-oidc-id' } });
      expect(mockToClass).toHaveBeenCalledWith(userData, User.prototype);
      expect(result).toEqual(userData);
    });

    it('should NOT convert OIDC ID to lowercase', async () => {
      mockFindOne.mockResolvedValue(TEST_USER);
      mockToClass.mockReturnValue(TEST_USER);

      await findUserByOIDC('OIDC-UPPERCASE-123');

      expect(mockFindOne).toHaveBeenCalledWith({ oidcId: { $eq: 'OIDC-UPPERCASE-123' } });
    });

    it('should return null when user not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await findUserByOIDC('nonexistent-oidc');

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('should get all users with empty query', async () => {
      const userData = [TEST_USER];
      mockToArray.mockResolvedValue(userData);
      mockToClass.mockImplementation((doc) => doc);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getUsers();

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockProject).toHaveBeenCalledWith({ password: 0 });
      expect(mockToArray).toHaveBeenCalled();
      expect(result).toEqual(userData);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should get users with username query and convert to lowercase', async () => {
      const userData = [TEST_USER];
      mockToArray.mockResolvedValue(userData);
      mockToClass.mockImplementation((doc) => doc);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getUsers({ username: 'TestUser' });

      expect(mockFind).toHaveBeenCalledWith({ username: 'testuser' });
      expect(result).toEqual(userData);

      consoleSpy.mockRestore();
    });

    it('should get users with email query and convert to lowercase', async () => {
      const userData = [TEST_USER];
      mockToArray.mockResolvedValue(userData);
      mockToClass.mockImplementation((doc) => doc);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getUsers({ email: 'Test@Example.com' });

      expect(mockFind).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual(userData);

      consoleSpy.mockRestore();
    });

    it('should get users with both username and email query', async () => {
      const userData = [TEST_USER];
      mockToArray.mockResolvedValue(userData);
      mockToClass.mockImplementation((doc) => doc);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getUsers({ username: 'TestUser', email: 'Test@Example.com' });

      expect(mockFind).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
      });
      expect(result).toEqual(userData);

      consoleSpy.mockRestore();
    });

    it('should exclude password field from results', async () => {
      mockToArray.mockResolvedValue([TEST_USER]);
      mockToClass.mockImplementation((doc) => doc);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await getUsers();

      expect(mockProject).toHaveBeenCalledWith({ password: 0 });

      consoleSpy.mockRestore();
    });

    it('should return empty array when no users found', async () => {
      mockToArray.mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getUsers();

      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('deleteUser', () => {
    it('should delete user by username', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await deleteUser('TestUser');

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockDeleteOne).toHaveBeenCalledWith({ username: 'testuser' });
    });

    it('should convert username to lowercase when deleting', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await deleteUser('UPPERCASE');

      expect(mockDeleteOne).toHaveBeenCalledWith({ username: 'uppercase' });
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const newUser: User = {
        username: 'NewUser',
        email: 'New@Example.com',
        oidcId: 'test-oidc-id-new',
      } as User;

      mockInsertOne.mockResolvedValue({ insertedId: new ObjectId() });

      await createUser(newUser);

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'new@example.com',
          oidcId: 'test-oidc-id-new',
        }),
      );
    });

    it('should convert username and email to lowercase', async () => {
      const newUser: User = {
        username: 'UPPERCASE',
        email: 'UPPERCASE@EXAMPLE.COM',
      } as User;

      mockInsertOne.mockResolvedValue({ insertedId: new ObjectId() });

      await createUser(newUser);

      expect(newUser.username).toBe('uppercase');
      expect(newUser.email).toBe('uppercase@example.com');
    });
  });

  describe('updateUser', () => {
    it('should update user by _id', async () => {
      const userUpdate: Partial<User> = {
        _id: '507f1f77bcf86cd799439011',
        email: 'Updated@Example.com',
      };

      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateUser(userUpdate);

      expect(mockConnect).toHaveBeenCalledWith('users');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { $set: { email: 'updated@example.com' } },
        { upsert: true },
      );
    });

    it('should update user by username when no _id provided', async () => {
      const userUpdate: Partial<User> = {
        username: 'TestUser',
        email: 'Updated@Example.com',
      };

      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateUser(userUpdate);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { username: 'testuser' },
        { $set: { username: 'testuser', email: 'updated@example.com' } },
        { upsert: true },
      );
    });

    it('should convert username and email to lowercase when updating', async () => {
      const userUpdate: Partial<User> = {
        username: 'UPPERCASE',
        email: 'UPPERCASE@EXAMPLE.COM',
      };

      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateUser(userUpdate);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { username: 'uppercase' },
        { $set: { username: 'uppercase', email: 'uppercase@example.com' } },
        { upsert: true },
      );
    });

    it('should not include _id in $set operation', async () => {
      const userUpdate: Partial<User> = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@example.com',
      };

      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateUser(userUpdate);

      const setOperation = mockUpdateOne.mock.calls[0][1].$set;
      expect(setOperation).not.toHaveProperty('_id');
      expect(setOperation).toHaveProperty('username');
      expect(setOperation).toHaveProperty('email');
    });

    it('should use upsert option', async () => {
      const userUpdate: Partial<User> = {
        username: 'newuser',
        email: 'new@example.com',
      };

      mockUpdateOne.mockResolvedValue({ upsertedCount: 1 });

      await updateUser(userUpdate);

      expect(mockUpdateOne).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
        upsert: true,
      });
    });

    it('should handle partial updates without username or email', async () => {
      const userUpdate: Partial<User> = {
        _id: '507f1f77bcf86cd799439011',
        oidcId: 'new-oidc-id',
      };

      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await updateUser(userUpdate);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { $set: { oidcId: 'new-oidc-id' } },
        { upsert: true },
      );
    });
  });
});
