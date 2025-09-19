const { expect } = require('chai');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Import both database implementations
const fileRepo = require('../../src/db/file/repo');
const fileUsers = require('../../src/db/file/users');
const mongoRepo = require('../../src/db/mongo/repo');
const mongoUsers = require('../../src/db/mongo/users');

describe('Database Comparison Tests', () => {
  let mongoClient;
  let mongoDb;
  let fileDbPath;

  before(async () => {
    // Setup MongoDB connection
    const connectionString =
      process.env.GIT_PROXY_MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/git-proxy-test';
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    mongoDb = mongoClient.db('git-proxy-test');

    // Setup file database path
    fileDbPath = path.join(__dirname, '../../test-data');
    if (!fs.existsSync(fileDbPath)) {
      fs.mkdirSync(fileDbPath, { recursive: true });
    }
  });

  after(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }

    // Clean up file database
    if (fs.existsSync(fileDbPath)) {
      fs.rmSync(fileDbPath, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clean MongoDB collections
    await mongoDb.collection('repos').deleteMany({});
    await mongoDb.collection('users').deleteMany({});

    // Clean file database
    const reposPath = path.join(fileDbPath, 'repos');
    const usersPath = path.join(fileDbPath, 'users');

    if (fs.existsSync(reposPath)) {
      fs.rmSync(reposPath, { recursive: true, force: true });
    }
    if (fs.existsSync(usersPath)) {
      fs.rmSync(usersPath, { recursive: true, force: true });
    }

    // Ensure directories exist
    fs.mkdirSync(reposPath, { recursive: true });
    fs.mkdirSync(usersPath, { recursive: true });

    // Clear module cache to ensure fresh instances
    delete require.cache[require.resolve('../../src/db/file/repo')];
    delete require.cache[require.resolve('../../src/db/file/users')];
    delete require.cache[require.resolve('../../src/db/mongo/repo')];
    delete require.cache[require.resolve('../../src/db/mongo/users')];
  });

  describe('Repository Operations Comparison', () => {
    it('should create repositories with same behavior', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      // Create in both databases
      const fileResult = await fileRepo.createRepo(repoData);
      const mongoResult = await mongoRepo.createRepo(repoData);

      // Both should return success
      expect(fileResult).to.have.property('insertedId');
      expect(mongoResult).to.have.property('insertedId');

      // Both should be retrievable
      const fileRepoData = await fileRepo.getRepo('test-repo');
      const mongoRepoData = await mongoRepo.getRepo('test-repo');

      expect(fileRepoData).to.have.property('name', 'test-repo');
      expect(mongoRepoData).to.have.property('name', 'test-repo');
      expect(fileRepoData).to.have.property('url', 'https://github.com/test/test-repo');
      expect(mongoRepoData).to.have.property('url', 'https://github.com/test/test-repo');
    });

    it('should get repositories by URL with same behavior', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await fileRepo.createRepo(repoData);
      await mongoRepo.createRepo(repoData);

      const fileRepoData = await fileRepo.getRepoByUrl('https://github.com/test/test-repo');
      const mongoRepoData = await mongoRepo.getRepoByUrl('https://github.com/test/test-repo');

      expect(fileRepoData).to.have.property('name', 'test-repo');
      expect(mongoRepoData).to.have.property('name', 'test-repo');
    });

    it('should add users to canPush with same behavior', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await fileRepo.createRepo(repoData);
      await mongoRepo.createRepo(repoData);

      await fileRepo.addUserCanPush('test-repo', 'newuser');
      await mongoRepo.addUserCanPush('test-repo', 'newuser');

      const fileRepoData = await fileRepo.getRepo('test-repo');
      const mongoRepoData = await mongoRepo.getRepo('test-repo');

      expect(fileRepoData.canPush).to.include('newuser');
      expect(mongoRepoData.canPush).to.include('newuser');
    });

    it('should delete repositories with same behavior', async () => {
      const repoData = {
        name: 'test-repo',
        url: 'https://github.com/test/test-repo',
        canPush: ['user1'],
        canAuthorise: ['user2'],
      };

      await fileRepo.createRepo(repoData);
      await mongoRepo.createRepo(repoData);

      await fileRepo.deleteRepo('test-repo');
      await mongoRepo.deleteRepo('test-repo');

      const fileRepoData = await fileRepo.getRepo('test-repo');
      const mongoRepoData = await mongoRepo.getRepo('test-repo');

      expect(fileRepoData).to.be.null;
      expect(mongoRepoData).to.be.null;
    });
  });

  describe('User Operations Comparison', () => {
    it('should create users with same behavior', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const fileResult = await fileUsers.createUser(userData);
      const mongoResult = await mongoUsers.createUser(userData);

      expect(fileResult).to.have.property('insertedId');
      expect(mongoResult).to.have.property('insertedId');

      const fileUser = await fileUsers.findUser('testuser');
      const mongoUser = await mongoUsers.findUser('testuser');

      expect(fileUser).to.have.property('username', 'testuser');
      expect(mongoUser).to.have.property('username', 'testuser');
      expect(fileUser).to.have.property('email', 'test@example.com');
      expect(mongoUser).to.have.property('email', 'test@example.com');
    });

    it('should find users by email with same behavior', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      await fileUsers.createUser(userData);
      await mongoUsers.createUser(userData);

      const fileUser = await fileUsers.findUserByEmail('test@example.com');
      const mongoUser = await mongoUsers.findUserByEmail('test@example.com');

      expect(fileUser).to.have.property('username', 'testuser');
      expect(mongoUser).to.have.property('username', 'testuser');
    });

    it('should update users with same behavior', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const fileResult = await fileUsers.createUser(userData);
      const mongoResult = await mongoUsers.createUser(userData);

      const fileUserId = fileResult.insertedId.toString();
      const mongoUserId = mongoResult.insertedId.toString();

      await fileUsers.updateUser(fileUserId, { email: 'newemail@example.com', admin: true });
      await mongoUsers.updateUser(mongoUserId, { email: 'newemail@example.com', admin: true });

      const fileUser = await fileUsers.findUser('testuser');
      const mongoUser = await mongoUsers.findUser('testuser');

      expect(fileUser).to.have.property('email', 'newemail@example.com');
      expect(mongoUser).to.have.property('email', 'newemail@example.com');
      expect(fileUser).to.have.property('admin', true);
      expect(mongoUser).to.have.property('admin', true);
    });

    it('should delete users with same behavior', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        gitAccount: 'testaccount',
        admin: false,
      };

      const fileResult = await fileUsers.createUser(userData);
      const mongoResult = await mongoUsers.createUser(userData);

      const fileUserId = fileResult.insertedId.toString();
      const mongoUserId = mongoResult.insertedId.toString();

      await fileUsers.deleteUser(fileUserId);
      await mongoUsers.deleteUser(mongoUserId);

      const fileUser = await fileUsers.findUser('testuser');
      const mongoUser = await mongoUsers.findUser('testuser');

      expect(fileUser).to.be.null;
      expect(mongoUser).to.be.null;
    });
  });

  describe('Error Handling Comparison', () => {
    it('should handle non-existent repositories consistently', async () => {
      const fileRepo = await fileRepo.getRepo('non-existent');
      const mongoRepo = await mongoRepo.getRepo('non-existent');

      expect(fileRepo).to.be.null;
      expect(mongoRepo).to.be.null;
    });

    it('should handle non-existent users consistently', async () => {
      const fileUser = await fileUsers.findUser('non-existent');
      const mongoUser = await mongoUsers.findUser('non-existent');

      expect(fileUser).to.be.null;
      expect(mongoUser).to.be.null;
    });

    it('should handle invalid operations consistently', async () => {
      // Try to add user to non-existent repo
      await fileRepo.addUserCanPush('non-existent', 'user1');
      await mongoRepo.addUserCanPush('non-existent', 'user1');

      // Both should not throw errors (graceful handling)
      const fileRepo = await fileRepo.getRepo('non-existent');
      const mongoRepo = await mongoRepo.getRepo('non-existent');

      expect(fileRepo).to.be.null;
      expect(mongoRepo).to.be.null;
    });
  });
});
