const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { CacheManager } = require('../../src/proxy/processors/push-action/cache-manager');

describe('CacheManager', () => {
  let testCacheDir;
  let cacheManager;

  beforeEach(() => {
    // Create temporary test cache directory
    testCacheDir = path.join('./.remote', 'test-cache-' + Date.now());
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
    cacheManager = new CacheManager(testCacheDir, 0.001, 3); // 1MB, 3 repos max
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('getCacheStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = cacheManager.getCacheStats();
      expect(stats.totalRepositories).to.equal(0);
      expect(stats.totalSizeMB).to.equal(0);
      expect(stats.repositories).to.be.an('array').that.is.empty;
    });

    it('should calculate stats for repositories in cache', () => {
      const repo1 = path.join(testCacheDir, 'repo1.git');
      const repo2 = path.join(testCacheDir, 'repo2.git');

      fs.mkdirSync(repo1);
      fs.mkdirSync(repo2);

      fs.writeFileSync(path.join(repo1, 'file1.txt'), 'a'.repeat(1024 * 1024)); // 1MB
      fs.writeFileSync(path.join(repo2, 'file2.txt'), 'b'.repeat(1024 * 1024)); // 1MB

      const stats = cacheManager.getCacheStats();
      expect(stats.totalRepositories).to.equal(2);
      expect(stats.totalSizeMB).to.be.at.least(2); // At least 2MB total
      expect(stats.repositories).to.have.lengthOf(2);
      expect(stats.repositories[0]).to.have.property('name');
      expect(stats.repositories[0]).to.have.property('sizeMB');
      expect(stats.repositories[0]).to.have.property('lastAccessed');
    });

    it('should have timestamps for repositories', () => {
      const repo1 = path.join(testCacheDir, 'repo1.git');
      const repo2 = path.join(testCacheDir, 'repo2.git');

      fs.mkdirSync(repo1);
      fs.writeFileSync(path.join(repo1, 'file1.txt'), 'test');

      fs.mkdirSync(repo2);
      fs.writeFileSync(path.join(repo2, 'file2.txt'), 'test');

      const stats = cacheManager.getCacheStats();
      expect(stats.repositories).to.have.lengthOf(2);
      // Each should have a valid timestamp
      stats.repositories.forEach((repo) => {
        expect(repo.lastAccessed).to.be.instanceOf(Date);
        expect(repo.lastAccessed.getTime()).to.be.greaterThan(0);
      });
    });
  });

  describe('touchRepository', () => {
    it('should update repository access time', async () => {
      const repoName = 'test-repo.git';
      const repoPath = path.join(testCacheDir, repoName);

      fs.mkdirSync(repoPath);
      fs.writeFileSync(path.join(repoPath, 'file.txt'), 'test');

      const statsBefore = cacheManager.getCacheStats();
      const timeBefore = statsBefore.repositories[0].lastAccessed.getTime();

      await new Promise((resolve) => setTimeout(resolve, 100));

      cacheManager.touchRepository(repoName);

      const statsAfter = cacheManager.getCacheStats();
      const timeAfter = statsAfter.repositories[0].lastAccessed.getTime();

      expect(timeAfter).to.be.greaterThan(timeBefore);
    });

    it('should not throw error for non-existent repository', () => {
      expect(() => cacheManager.touchRepository('non-existent.git')).to.not.throw();
    });
  });

  describe('enforceLimits', () => {
    it('should remove oldest repositories when exceeding count limit', () => {
      // Create 4 repos (exceeds limit of 3)
      for (let i = 1; i <= 4; i++) {
        const repoPath = path.join(testCacheDir, `repo${i}.git`);
        fs.mkdirSync(repoPath);
        fs.writeFileSync(path.join(repoPath, 'file.txt'), 'a'.repeat(100 * 1024)); // 100KB
      }

      const statsBefore = cacheManager.getCacheStats();
      expect(statsBefore.totalRepositories).to.equal(4);

      const result = cacheManager.enforceLimits();

      expect(result.removedRepos).to.have.lengthOf.at.least(1);
      expect(result.freedMB).to.be.at.least(0);

      const statsAfter = cacheManager.getCacheStats();
      expect(statsAfter.totalRepositories).to.be.at.most(3);
    });

    it('should remove repositories when exceeding size limit', () => {
      // Create repo that exceeds size limit (1MB)
      const repo1 = path.join(testCacheDir, 'repo1.git');
      fs.mkdirSync(repo1);
      fs.writeFileSync(path.join(repo1, 'largefile.txt'), 'a'.repeat(2 * 1024 * 1024)); // 2MB

      const statsBefore = cacheManager.getCacheStats();
      expect(statsBefore.totalSizeMB).to.be.greaterThan(1);

      const result = cacheManager.enforceLimits();

      expect(result.removedRepos).to.have.lengthOf(1);
      expect(result.freedMB).to.be.greaterThan(1);

      const statsAfter = cacheManager.getCacheStats();
      expect(statsAfter.totalRepositories).to.equal(0);
    });

    it('should not remove anything if limits not exceeded', () => {
      // Create 2 repos (under limit of 3)
      for (let i = 1; i <= 2; i++) {
        const repoPath = path.join(testCacheDir, `repo${i}.git`);
        fs.mkdirSync(repoPath);
        fs.writeFileSync(path.join(repoPath, 'file.txt'), 'test');
      }

      const result = cacheManager.enforceLimits();

      expect(result.removedRepos).to.be.empty;
      expect(result.freedMB).to.equal(0);
    });
  });

  describe('getConfig', () => {
    it('should return cache configuration', () => {
      const config = cacheManager.getConfig();

      expect(config).to.deep.equal({
        maxSizeGB: 0.001,
        maxRepositories: 3,
        cacheDir: testCacheDir,
      });
    });
  });
});
