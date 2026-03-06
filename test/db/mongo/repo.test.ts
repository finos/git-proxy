import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Repo } from '../../../src/db/types';
import { ObjectId } from 'mongodb';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockToArray = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteMany = vi.fn();

const mockConnect = vi.fn(() => ({
  findOne: mockFindOne,
  find: mockFind,
  insertOne: mockInsertOne,
  updateOne: mockUpdateOne,
  deleteMany: mockDeleteMany,
}));

const mockToClass = vi.fn((doc, proto) => Object.assign(Object.create(proto), doc));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
}));

vi.mock('../../../src/db/helper', () => ({
  toClass: mockToClass,
}));

describe('MongoDB Repo', async () => {
  const {
    getRepos,
    getRepo,
    getRepoByUrl,
    getRepoById,
    createRepo,
    addUserCanPush,
    addUserCanAuthorise,
    removeUserCanPush,
    removeUserCanAuthorise,
    deleteRepo,
  } = await import('../../../src/db/mongo/repo');

  const TEST_REPO: Repo = {
    _id: '507f1f77bcf86cd799439011',
    name: 'sample',
    project: 'test-project',
    users: { canPush: ['user1'], canAuthorise: ['admin1'] },
    url: 'https://github.com/finos/git-proxy.git',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ toArray: mockToArray });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRepos', () => {
    it('should get all repos with empty query', async () => {
      const repoData = [TEST_REPO];
      mockToArray.mockResolvedValue(repoData);
      mockToClass.mockImplementation((doc) => doc);

      const result = await getRepos();

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockToArray).toHaveBeenCalled();
      expect(result).toEqual(repoData);
    });

    it('should get repos with custom query', async () => {
      const query = { name: 'sample' };
      const repoData = [TEST_REPO];
      mockToArray.mockResolvedValue(repoData);
      mockToClass.mockImplementation((doc) => doc);

      const result = await getRepos(query);

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFind).toHaveBeenCalledWith(query);
      expect(mockToArray).toHaveBeenCalled();
      expect(result).toEqual(repoData);
    });

    it('should return empty array when no repos found', async () => {
      mockToArray.mockResolvedValue([]);

      const result = await getRepos();

      expect(result).toEqual([]);
    });
  });

  describe('getRepo', () => {
    it('should get the repo using the name', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'http://example.com/sample-repo.git',
      };
      mockFindOne.mockResolvedValue(repoData);
      mockToClass.mockReturnValue(repoData);

      const result = await getRepo('Sample');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({ name: { $eq: 'sample' } });
      expect(mockToClass).toHaveBeenCalledWith(repoData, Repo.prototype);
    });

    it('should return null when repo not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await getRepo('NonExistent');

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('getRepoByUrl', () => {
    it('should get the repo using the url', async () => {
      const repoData: Partial<Repo> = {
        name: 'sample',
        users: { canPush: [], canAuthorise: [] },
        url: 'https://github.com/finos/git-proxy.git',
      };
      mockFindOne.mockResolvedValue(repoData);
      mockToClass.mockReturnValue(repoData);

      const result = await getRepoByUrl('https://github.com/finos/git-proxy.git');

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({
        url: { $eq: 'https://github.com/finos/git-proxy.git' },
      });
      expect(mockToClass).toHaveBeenCalledWith(repoData, Repo.prototype);
    });

    it('should return null when repo not found by url', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await getRepoByUrl('https://example.com/nonexistent.git');

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('getRepoById', () => {
    it('should get the repo using the _id', async () => {
      const repoData = { ...TEST_REPO };
      mockFindOne.mockResolvedValue(repoData);
      mockToClass.mockReturnValue(repoData);

      const result = await getRepoById(TEST_REPO._id!);

      expect(result).toEqual(repoData);
      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: new ObjectId(TEST_REPO._id!),
      });
      expect(mockToClass).toHaveBeenCalledWith(repoData, Repo.prototype);
    });

    it('should return null when repo not found by id', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await getRepoById(TEST_REPO._id!);

      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('createRepo', () => {
    it('should create a new repo', async () => {
      const newRepo: Repo = {
        project: 'test-project',
        name: 'new-repo',
        users: { canPush: [], canAuthorise: [] },
        url: 'https://github.com/example/new-repo.git',
      };

      const insertedId = new ObjectId(TEST_REPO._id!);
      mockInsertOne.mockResolvedValue({ insertedId });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await createRepo(newRepo);

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockInsertOne).toHaveBeenCalledWith(newRepo);
      expect(result._id).toBe(insertedId.toString());
      expect(result.name).toBe('new-repo');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('addUserCanPush', () => {
    it('should add user to canPush list', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await addUserCanPush(TEST_REPO._id!, 'NewUser');

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $push: { 'users.canPush': 'newuser' } },
      );
    });

    it('should convert username to lowercase', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await addUserCanPush(TEST_REPO._id!, 'UPPERCASE');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $push: { 'users.canPush': 'uppercase' } },
      );
    });
  });

  describe('addUserCanAuthorise', () => {
    it('should add user to canAuthorise list', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await addUserCanAuthorise(TEST_REPO._id!, 'NewAdmin');

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $push: { 'users.canAuthorise': 'newadmin' } },
      );
    });

    it('should convert username to lowercase', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await addUserCanAuthorise(TEST_REPO._id!, 'ADMIN');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $push: { 'users.canAuthorise': 'admin' } },
      );
    });
  });

  describe('removeUserCanPush', () => {
    it('should remove user from canPush list', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await removeUserCanPush(TEST_REPO._id!, 'User1');

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $pull: { 'users.canPush': 'user1' } },
      );
    });

    it('should convert username to lowercase', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await removeUserCanPush(TEST_REPO._id!, 'USER');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $pull: { 'users.canPush': 'user' } },
      );
    });
  });

  describe('removeUserCanAuthorise', () => {
    it('should remove user from canAuthorise list', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await removeUserCanAuthorise(TEST_REPO._id!, 'Admin1');

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $pull: { 'users.canAuthorise': 'admin1' } },
      );
    });

    it('should convert username to lowercase', async () => {
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await removeUserCanAuthorise(TEST_REPO._id!, 'ADMIN');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(TEST_REPO._id!) },
        { $pull: { 'users.canAuthorise': 'admin' } },
      );
    });
  });

  describe('deleteRepo', () => {
    it('should delete a repo by _id', async () => {
      mockDeleteMany.mockResolvedValue({ deletedCount: 1 });

      await deleteRepo(TEST_REPO._id!);

      expect(mockConnect).toHaveBeenCalledWith('repos');
      expect(mockDeleteMany).toHaveBeenCalledWith({
        _id: new ObjectId(TEST_REPO._id),
      });
    });
  });
});
