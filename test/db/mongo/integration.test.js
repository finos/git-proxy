const { expect } = require('chai');
const { MongoClient } = require('mongodb');

// Import the MongoDB client modules
const mongoRepo = require('../../../src/db/mongo/repo');
const mongoUsers = require('../../../src/db/mongo/users');

describe('MongoDB Integration Tests', () => {
  let client;
  let db;
  let reposCollection;
  let usersCollection;

  before(async () => {
    // Connect to MongoDB
    const connectionString =
      process.env.GIT_PROXY_MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/git-proxy-test';
    client = new MongoClient(connectionString);
    await client.connect();
    db = client.db('git-proxy-test');
    reposCollection = db.collection('repos');
    usersCollection = db.collection('users');
  });

  after(async () => {
    if (client) {
      await client.close();
    }
  });

  beforeEach(async () => {
    // Clean collections before each test
    await reposCollection.deleteMany({});
    await usersCollection.deleteMany({});

    // Clear module cache to ensure fresh instances
    delete require.cache[require.resolve('../../../src/db/mongo/repo')];
    delete require.cache[require.resolve('../../../src/db/mongo/users')];
  });

  describe('Repository Operations', () => {
    it('should create a repository', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      const result = await mongoRepo.createRepo(repoData);
      expect(result).to.have.property('insertedId');

      const createdRepo = await reposCollection.findOne({ _id: result.insertedId });
      expect(createdRepo).to.have.property('name', 'test-repo');
      expect(createdRepo).to.have.property('url', 'https://github.com/test/test-repo');
    });

    it('should get a repository by name', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      const repo = await mongoRepo.getRepo('test-repo');

      expect(repo).to.have.property('name', 'test-repo');
      expect(repo).to.have.property('url', 'https://github.com/test/test-repo');
    });

    it('should get a repository by URL', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      const repo = await mongoRepo.getRepoByUrl('https://github.com/test/test-repo');

      expect(repo).to.have.property('name', 'test-repo');
      expect(repo).to.have.property('url', 'https://github.com/test/test-repo');
    });

    it('should get a repository by ID', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      const result = await mongoRepo.createRepo(repoData);
      const repo = await mongoRepo.getRepoById(result.insertedId.toString());

      expect(repo).to.have.property('name', 'test-repo');
      expect(repo).to.have.property('url', 'https://github.com/test/test-repo');
    });

    it('should get all repositories', async () => {
      const repo1 = {
        name: 'test-repo-1',
        url: 'https://github.com/test/test-repo-1',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };
      const repo2 = {
        name: 'test-repo-2',
        url: 'https://github.com/test/test-repo-2',
        canPush: ['user3'],
        canAuthorise: ['user4'],
      };

      await mongoRepo.createRepo(repo1);
      await mongoRepo.createRepo(repo2);

      const repos = await mongoRepo.getRepos();
      expect(repos).to.have.length(2);
    });

    it('should add user to canPush', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      await mongoRepo.addUserCanPush('test-repo', 'newuser');

      const repo = await mongoRepo.getRepo('test-repo');
      expect(repo.canPush).to.include('newuser');
    });

    it('should add user to canAuthorise', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      await mongoRepo.addUserCanAuthorise('test-repo', 'newuser');

      const repo = await mongoRepo.getRepo('test-repo');
      expect(repo.canAuthorise).to.include('newuser');
    });

    it('should remove user from canPush', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1', 'user2'],
        canAuthorise: ['user3'],
      };

      await mongoRepo.createRepo(repoData);
      await mongoRepo.removeUserCanPush('test-repo', 'user1');

      const repo = await mongoRepo.getRepo('test-repo');
      expect(repo.canPush).to.not.include('user1');
      expect(repo.canPush).to.include('user2');
    });

    it('should remove user from canAuthorise', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2', 'user3'],
      };

      await mongoRepo.createRepo(repoData);
      await mongoRepo.removeUserCanAuthorise('test-repo', 'user2');

      const repo = await mongoRepo.getRepo('test-repo');
      expect(repo.canAuthorise).to.not.include('user2');
      expect(repo.canAuthorise).to.include('user3');
    });

    it('should delete a repository', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      await mongoRepo.deleteRepo('test-repo');

      const repo = await mongoRepo.getRepo('test-repo');
      expect(repo).to.be.null;
    });

    it('should handle case-insensitive repository names', async () => {
      const repoData = {
        name: 'Test-Repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);
      const repo = await mongoRepo.getRepo('test-repo');

      expect(repo).to.have.property('name', 'Test-Repo');
    });

    it('should handle invalid ObjectId gracefully', async () => {
      const repo = await mongoRepo.getRepoById('invalid-id');
      expect(repo).to.be.null;
    });
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const result = await mongoUsers.createUser(userData);
      expect(result).to.have.property('insertedId');

      const createdUser = await usersCollection.findOne({ _id: result.insertedId });
      expect(createdUser).to.have.property('username', 'testuser');
      expect(createdUser).to.have.property('email', 'test@example.com');
    });

    it('should find a user by username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      await mongoUsers.createUser(userData);
      const user = await mongoUsers.findUser('testuser');

      expect(user).to.have.property('username', 'testuser');
      expect(user).to.have.property('email', 'test@example.com');
    });

    it('should find a user by email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      await mongoUsers.createUser(userData);
      const user = await mongoUsers.findUserByEmail('test@example.com');

      expect(user).to.have.property('username', 'testuser');
      expect(user).to.have.property('email', 'test@example.com');
    });

    it('should find a user by OIDC', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
        oidc: 'oidc-123',
      };

      await mongoUsers.createUser(userData);
      const user = await mongoUsers.findUserByOIDC('oidc-123');

      expect(user).to.have.property('username', 'testuser');
      expect(user).to.have.property('oidc', 'oidc-123');
    });

    it('should get all users', async () => {
      const user1 = {
        username: 'user1',
        email: 'user1@example.com',
        gitAccount: 'account1',
        admin: false,
      };
      const user2 = {
        username: 'user2',
        email: 'user2@example.com',
        gitAccount: 'account2',
        admin: true,
      };

      await mongoUsers.createUser(user1);
      await mongoUsers.createUser(user2);

      const users = await mongoUsers.getUsers();
      expect(users).to.have.length(2);
    });

    it('should update a user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const result = await mongoUsers.createUser(userData);
      const userId = result.insertedId.toString();

      await mongoUsers.updateUser(userId, { email: 'newemail@example.com', admin: true });

      const updatedUser = await mongoUsers.findUser('testuser');
      expect(updatedUser).to.have.property('email', 'newemail@example.com');
      expect(updatedUser).to.have.property('admin', true);
    });

    it('should delete a user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const result = await mongoUsers.createUser(userData);
      const userId = result.insertedId.toString();

      await mongoUsers.deleteUser(userId);

      const user = await mongoUsers.findUser('testuser');
      expect(user).to.be.null;
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate repository names', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await mongoRepo.createRepo(repoData);

      try {
        await mongoRepo.createRepo(repoData);
        expect.fail('Should have thrown an error for duplicate repository');
      } catch (error) {
        expect(error.code).to.equal(11000); // Duplicate key error
      }
    });

    it('should handle duplicate usernames', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      await mongoUsers.createUser(userData);

      try {
        await mongoUsers.createUser(userData);
        expect.fail('Should have thrown an error for duplicate username');
      } catch (error) {
        expect(error.code).to.equal(11000); // Duplicate key error
      }
    });

    it('should handle non-existent repository operations', async () => {
      const repo = await mongoRepo.getRepo('non-existent-repo');
      expect(repo).to.be.null;

      const repoByUrl = await mongoRepo.getRepoByUrl('https://github.com/non/existent');
      expect(repoByUrl).to.be.null;
    });

    it('should handle non-existent user operations', async () => {
      const user = await mongoUsers.findUser('non-existent-user');
      expect(user).to.be.null;

      const userByEmail = await mongoUsers.findUserByEmail('nonexistent@example.com');
      expect(userByEmail).to.be.null;
    });
  });
});
